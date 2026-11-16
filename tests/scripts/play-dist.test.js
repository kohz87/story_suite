import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDist, parseArgs } from '../../scripts/play/dist.mjs';
import { DIST_SET } from '../../scripts/play/dist-sets.mjs';

let source;
let out;
const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

before(() => {
  source = fs.mkdtempSync(path.join(os.tmpdir(), 'play-dist-src-'));
  put(source, 'manifest.json', JSON.stringify({ display_name: 'Story Suite', js: 'index.js', css: 'suite.css', generate_interceptor: 'storyBlockGenerationInterceptor', version: '0.1.0' }));
  put(source, 'suite.css', "@import url('./ui/look.css');\n");
  put(source, 'index.js', "import { asset } from './core/asset.js';\nglobalThis.suite = asset;\nimport('./modules/people/legacy/bootstrap.js');\n");
  put(source, 'core/asset.js', "export const asset = new URL('./look.css', import.meta.url).href;\n");
  put(source, 'core/look.css', '.look { color: red; }\n');
  put(source, 'assets/font.woff2', 'font');
  put(source, 'ui/look.css', '.ui { color: blue; }\n');
  put(source, 'modules/people/legacy/bootstrap.js', "import { getContext } from '../../../../../../extensions.js';\nawait import('./part.js');\nglobalThis.npcState = getContext;\n");
  put(source, 'modules/people/legacy/part.js', "import { getContext } from '../../../../../../../script.js';\nglobalThis.npcHost = getContext;\n");
  out = path.join(source, 'out');
});

after(() => fs.rmSync(source, { recursive: true, force: true }));

test('the dist is one extension folder: the repo manifest named as the play build, the bundle, the stylesheet and the build record', async () => {
  const fixed = new Date('2026-11-16T00:00:00Z');
  await buildDist({ repo: source, commit: 'a'.repeat(40), source, out, write: false, now: fixed });
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display_name, 'Story Suite (play build)');
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'suite.css');
  assert.equal(manifest.generate_interceptor, 'storyBlockGenerationInterceptor');
  assert.ok(fs.existsSync(path.join(out, 'index.js')));
  assert.equal(fs.readFileSync(path.join(out, 'suite.css'), 'utf8'), "@import url('./ui/look.css');\n");
  assert.match(fs.readFileSync(path.join(out, 'BUILD.txt'), 'utf8'), new RegExp(`source commit: ${'a'.repeat(40)}`));
  assert.equal(fs.readFileSync(path.join(out, 'core', 'look.css'), 'utf8'), '.look { color: red; }\n');
  assert.equal(fs.readFileSync(path.join(out, 'assets', 'font.woff2'), 'utf8'), 'font');
  assert.equal(fs.readFileSync(path.join(out, 'ui', 'look.css'), 'utf8'), '.ui { color: blue; }\n');
});

test('host imports keep the depth the host expects from the extension folder', async () => {
  const code = fs.readdirSync(out).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(out, name), 'utf8')).join('\n');
  assert.match(code, /from "\.\.\/\.\.\/\.\.\/extensions\.js"/);
  assert.match(code, /from "\.\.\/\.\.\/\.\.\/\.\.\/script\.js"/);
});

test('the bundle names a module by its path from the extension folder, so a stylesheet beside it resolves in the copied folder', async () => {
  assert.match(fs.readFileSync(path.join(out, 'index.js'), 'utf8'), /new URL\("core\/asset\.js", import\.meta\.url\)/);
  assert.ok(!fs.existsSync(path.join(out, 'core', 'asset.js')), 'source JS is not copied');
});

test('the one set is the release set: the root index.js', () => {
  assert.deepEqual(DIST_SET.entries, ['index.js']);
});

test('two builds of the same source are byte-identical with the same clock', async () => {
  const first = path.join(source, 'out1');
  const second = path.join(source, 'out2');
  const fixed = new Date('2026-11-16T00:00:00Z');
  await buildDist({ repo: source, commit: 'b'.repeat(40), source, out: first, write: false, now: fixed });
  await buildDist({ repo: source, commit: 'b'.repeat(40), source, out: second, write: false, now: fixed });
  const walk = (dir, base) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name), base) : [path.relative(base, path.join(dir, entry.name))]).sort();
  const files = walk(first, first);
  assert.deepEqual(walk(second, second), files);
  for (const file of files) assert.ok(fs.readFileSync(path.join(first, file)).equals(fs.readFileSync(path.join(second, file))), file);
});

test('parseArgs reads the options and rejects an unknown one', () => {
  assert.deepEqual(parseArgs(['--repo', '/r', '--commit', 'c', '--no-commit']), { repo: '/r', commit: 'c', branch: 'play', write: false });
  assert.throws(() => parseArgs(['--push']));
  assert.throws(() => parseArgs(['--out']));
  assert.throws(() => parseArgs(['--install-folder', 'x']));
});
