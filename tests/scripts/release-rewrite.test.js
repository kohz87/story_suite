import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { rewriteSource, strayImportMeta } from '../../scripts/release/rewrite.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const packAll = spec => `src/${spec.slice(2)}`;

test('the rewrite reads the syntax tree: a comment, a string and a template literal naming import() are left alone', () => {
  const source = [
    "// a comment: import('./x.js') and import.meta.url",
    "/* import('./y.js') */",
    "const a = \"import('./x.js')\";",
    "const b = `import('./x.js') ${1} import.meta.url`;",
    "const c = () => import('./x.js');",
    "const d = import.meta.url;",
  ].join('\n');
  const out = rewriteSource(source, 'src/m.js', packAll);
  const lines = out.split('\n');
  assert.deepEqual(lines.slice(0, 4), source.split('\n').slice(0, 4));
  assert.equal(lines[4], `const c = () => __releasePackOnce("src/x.js", () => Promise.resolve().then(() => require('./x.js')));`);
  assert.equal(lines[5], 'const d = new URL("src/m.js", import.meta.url).href;');
  assert.match(lines.at(-2), /^import \{ once as __releasePackOnce \} from "release:pack";$/);
});

test('the rewrite leaves lazy and non-literal imports alone', () => {
  const source = "const a = import('./lazy.js'); const b = import(path); const c = import(`./t.js`); const d = import('/script.js');";
  const out = rewriteSource(source, 'm.js', spec => (spec === './lazy.js' ? null : spec));
  assert.equal(out, source);
});

test('the gate helper counts import.meta uses that are not the rewritten form', () => {
  assert.equal(strayImportMeta('const a = new URL("src/m.js", import.meta.url).href;'), 0);
  assert.equal(strayImportMeta('const a = import.meta.url; const b = import.meta.dirname;'), 2);
});

let root;
before(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-rewrite-')); });
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('a stylesheet named from import.meta.url resolves to the same file in the bundle as in the source', async () => {
  const pkg = path.join(root, 'pkg/demo');
  fs.mkdirSync(path.join(pkg, 'deep/er'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'boot.js'), "export { sheet } from './deep/er/mod.js';\n");
  fs.writeFileSync(path.join(pkg, 'deep/er/mod.js'), "export const sheet = new URL('../x.css', import.meta.url).href;\n");
  fs.writeFileSync(path.join(pkg, 'deep/x.css'), 'a {}\n');
  const out = path.join(root, 'out');
  await buildBundleSet({ name: 'demo', dir: 'pkg/demo', entries: ['boot.js'], lazy: [] }, out, root);
  const bundled = (await import(pathToFileURL(path.join(out, 'boot.js')).href)).sheet;
  const source = (await import(pathToFileURL(path.join(pkg, 'boot.js')).href)).sheet;
  assert.equal(source, pathToFileURL(path.join(pkg, 'deep/x.css')).href);
  assert.equal(bundled, pathToFileURL(path.join(out, 'deep/x.css')).href);
});

// Every location-relative reference in the real packages: found by walking the syntax tree of the runtime
// modules (not scripts, tests, the testkit or examples), compared with the bundles.
const SKIP = new Set(['node_modules', 'scripts', 'tests', 'testkit', 'authoring-kit', 'examples', 'docs']);
function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.')) sourceFiles(path.join(dir, entry.name), found);
    else if (entry.isFile() && entry.name.endsWith('.js')) found.push(path.join(dir, entry.name));
  }
  return found;
}
// Where a set's runtime modules sit: its old package folder if the checkout has it, plus the new roots (the
// Story Block set is core, modules, packs and the old UI; the Story Director set is the old UI's director folder).
const NEW_ROOTS = { 'story-block': ['core', 'modules', 'packs', 'ui/legacy'], 'story-director': ['ui/legacy/director'], 'npc-state-delta': [] };
const setFiles = set => [set.dir, ...NEW_ROOTS[set.name]].map(dir => path.join(repoRoot, dir)).filter(dir => fs.existsSync(dir))
  .flatMap(dir => sourceFiles(dir)).filter(file => set.name === 'story-block' ? !file.includes('/ui/legacy/director/') : true);
const metaUsers = files => files.filter(file => {
  let found = false;
  walk.full(acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }), node => { if (node.type === 'MetaProperty') found = true; });
  return found;
});
const relativeAssets = file => {
  const found = [];
  walk.full(acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }), node => {
    if (node.type === 'Literal' && typeof node.value === 'string' && /^\.\.?\/.*\.(css|json|html|svg|png|woff2?)$/.test(node.value)) found.push(node.value);
  });
  return found;
};

for (const set of BUNDLE_SETS) {
  test(`${set.name}: every import.meta.url reference resolves, bundled, to the same existing file as in the source`, async () => {
    const pkgDir = path.join(repoRoot, set.dir);
    const out = path.join(root, `real-${set.name}`);
    const files = await buildBundleSet(set, out, repoRoot);
    const bundled = new Map();
    for (const file of files.filter(name => name.endsWith('.js'))) {
      for (const [, rel] of fs.readFileSync(path.join(out, file), 'utf8').matchAll(/new URL\("([^"]+)", import\.meta\.url\)\.href/g)) bundled.set(rel, file);
    }
    const wanted = metaUsers(setFiles(set)).map(file => path.relative(pkgDir, file).split(path.sep).join('/'));
    for (const rel of wanted) assert.ok(bundled.has(rel), `${rel} uses import.meta.url and is not rewritten in the bundle`);
    for (const rel of bundled.keys()) {
      const sourceFile = path.join(pkgDir, rel);
      assert.ok(fs.existsSync(sourceFile), `${rel}: the module the bundle names does not exist`);
      const sourceUrl = pathToFileURL(sourceFile).href;
      const bundleUrl = new URL(rel, pathToFileURL(path.join(out, bundled.get(rel)))).href;
      assert.equal(bundleUrl, pathToFileURL(path.join(out, rel)).href);
      for (const asset of relativeAssets(sourceFile)) {
        const fromSource = new URL(asset, sourceUrl);
        const fromBundle = new URL(asset, bundleUrl);
        assert.ok(fs.existsSync(fromSource), `${rel}: ${asset} does not exist in the source`);
        assert.equal(path.relative(out, new URL(fromBundle).pathname), path.relative(pkgDir, fromSource.pathname), `${rel}: ${asset}`);
      }
    }
  });
}

test('the three packages hold the two known references, so the check above is not empty', () => {
  const all = BUNDLE_SETS.flatMap(set => metaUsers(setFiles(set)).map(file => path.relative(repoRoot, file)));
  assert.deepEqual(all.sort(), ['modules/rpg/view/index-parts/mount.js', 'packages/npc-state-delta/suite-handshake-parts/stylesheet.js']);
});
