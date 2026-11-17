import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { walkBundle } from '../../scripts/release/graph.mjs';
import { MARKER, assertSafeOut, claimOutDir } from '../../scripts/release/outdir.mjs';
import { strayImportMeta } from '../../scripts/release/rewrite.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
let temp;
before(() => { temp = tempDir('release-guard-'); });
after(() => fs.rmSync(temp, { recursive: true, force: true }));

function makeRepo(parts) {
  const root = path.join(temp, ...parts);
  for (const dir of ['packages/demo', 'ui', 'scripts', 'tests']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages/demo/boot.js'), "import { a } from '../../../../../../script.js';\nimport { b } from './deep/mod.js';\nexport const both = [a, b];\n");
  fs.mkdirSync(path.join(root, 'packages/demo/deep'));
  fs.writeFileSync(path.join(root, 'packages/demo/deep/mod.js'), "import { c } from '../../../../../../../script.js';\nimport { d } from '../../../../../../extensions.js';\nexport const b = [c, d];\n");
  return root;
}
const SET = { name: 'demo', entries: ['packages/demo/boot.js'], lazy: [] };

test('an output folder that is the repo, a parent of it, or in or around the source is refused', () => {
  const root = makeRepo(['guard-repo']);
  for (const bad of [root, temp, path.join(root, 'packages'), path.join(root, 'packages/demo'), path.join(root, 'packages/demo/out'), path.join(root, 'ui'), path.join(root, 'scripts'), path.join(root, 'tests/x')]) {
    assert.throws(() => assertSafeOut(bad, root), /release: --out/, bad);
  }
  assertSafeOut(path.join(root, 'dist/release'), root);
  assertSafeOut(path.join(temp, 'elsewhere'), root);
});

test('the build refuses an unmarked folder and leaves it as it was', async () => {
  const root = makeRepo(['guard-unmarked']);
  const out = path.join(root, 'dist');
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'keep.txt'), 'mine');
  await assert.rejects(buildBundleSet(SET, out, root), /not made by the release build/);
  assert.equal(fs.readFileSync(path.join(out, 'keep.txt'), 'utf8'), 'mine');
  await assert.rejects(buildBundleSet(SET, path.join(root, 'packages'), root), /release: --out/);
  assert.ok(fs.existsSync(path.join(root, 'packages/demo/boot.js')));
});

test('a folder the build made is rebuilt in place, marker included, and nothing else is touched', async () => {
  const root = makeRepo(['guard-marked']);
  const out = path.join(root, 'dist/demo');
  await buildBundleSet(SET, out, root);
  assert.ok(fs.existsSync(path.join(out, MARKER)));
  fs.writeFileSync(path.join(out, 'stale.js'), 'x');
  claimOutDir(out);
  assert.deepEqual(fs.readdirSync(out), [MARKER]);
});

test('the CLI refuses --out modules and --out . before it deletes anything', () => {
  const before = fs.readdirSync(path.join(repoRoot, 'modules')).sort();
  for (const out of ['modules', '.', 'ui', 'modules/people']) {
    const run = spawnSync(process.execPath, ['scripts/release.mjs', '--out', out], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 2, `${out}: ${run.stderr}`);
    assert.match(run.stderr, /release: --out/);
  }
  assert.deepEqual(fs.readdirSync(path.join(repoRoot, 'modules')).sort(), before);
  assert.ok(fs.existsSync(path.join(repoRoot, 'core/boot/boot.js')));
});

test('host specifiers are resolved as URLs: the same bundle whatever depth the checkout sits at', async () => {
  const shallow = makeRepo(['a']);
  const deep = makeRepo(['b', 'c', 'd', 'e', 'f', 'g']);
  const outs = [];
  for (const root of [shallow, deep]) {
    const out = path.join(root, 'dist/demo');
    await buildBundleSet(SET, out, root);
    outs.push(out);
  }
  const names = fs.readdirSync(outs[0]).sort();
  assert.deepEqual(fs.readdirSync(outs[1]).sort(), names);
  for (const name of names) assert.ok(fs.readFileSync(path.join(outs[0], name)).equals(fs.readFileSync(path.join(outs[1], name))), name);
  // boot.js sits two folders down (six ../ reach /script.js); deep/mod.js is one folder lower (seven for /script.js, six for
  // /scripts/extensions.js). All are written from the extension folder, where the chunks sit.
  assert.deepEqual(walkBundle(outs[0], 'boot.js').host, ['../../../../script.js', '../../../extensions.js']);
});

test('the gate rejects the original bug shape and keeps the rewritten one', () => {
  assert.equal(strayImportMeta("const u = new URL('../suite.css', import.meta.url);"), 1);
  assert.equal(strayImportMeta("const u = new URL('../suite.css', import.meta.url).href;"), 1);
  assert.equal(strayImportMeta('const u = new URL("src/m.js", import.meta.url).href;'), 0);
  assert.equal(strayImportMeta("const u = new URL('../x.css', new URL(\"src/m.js\", import.meta.url).href);"), 0);
  assert.equal(strayImportMeta('function F() { return new.target; }'), 0);
});

test('package.json and package-lock.json say the same version', () => {
  const read = file => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
  assert.equal(read('package-lock.json').version, read('package.json').version);
  assert.equal(read('package-lock.json').packages[''].version, read('package.json').version);
});
