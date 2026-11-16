import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDist, parseArgs } from '../../scripts/play/dist.mjs';
import { DIST_SETS } from '../../scripts/play/dist-sets.mjs';

let source;
let out;
const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

before(() => {
  source = fs.mkdtempSync(path.join(os.tmpdir(), 'play-dist-src-'));
  put(source, 'packages/story-block/index.js', "import { asset } from './src/asset.js';\nglobalThis.storyBlock = asset;\n");
  put(source, 'packages/story-block/src/asset.js', "export const asset = new URL('./look.css', import.meta.url).href;\n");
  put(source, 'packages/story-block/src/look.css', '.look { color: red; }\n');
  put(source, 'packages/story-block/assets/font.woff2', 'font');
  put(source, 'packages/story-block/host.css', '@import url(\'./src/look.css\');\n');
  put(source, 'packages/story-director/index.js', 'globalThis.storyDirector = 1;\n');
  put(source, 'packages/npc-state-delta/bootstrap.js', "import { getContext } from '../../../extensions.js';\nawait import('./part.js');\nglobalThis.npcState = getContext;\n");
  put(source, 'packages/npc-state-delta/part.js', "import { getContext } from '../../../../extensions.js';\nglobalThis.npcHost = getContext;\n");
  put(source, 'packages/npc-state-delta/style.css', '.npc { color: blue; }\n');
  put(source, 'ui/st-entry.js', "globalThis.preview = new URL('./', import.meta.url).href;\n");
  put(source, 'ui/css/next-hide.css', '.next { display: none; }\n');
  out = path.join(source, 'out');
});

after(() => fs.rmSync(source, { recursive: true, force: true }));

test('the dist is one extension folder with a root manifest, entry, stylesheet and build record', async () => {
  const fixed = new Date('2026-11-16T00:00:00Z');
  await buildDist({ repo: source, commit: 'a'.repeat(40), source, out, write: false, now: fixed });
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display_name, 'Story Suite (play build)');
  assert.equal(manifest.js, 'entry.js');
  assert.equal(manifest.css, 'style.css');
  assert.equal(manifest.generate_interceptor, 'storyBlockGenerationInterceptor');
  assert.deepEqual(fs.readFileSync(path.join(out, 'entry.js'), 'utf8').match(/import '\.\/([^']+)'/g), [
    "import './story-block/index.js'", "import './story-director/index.js'", "import './npc-state-delta/bootstrap.js'", "import './ui/st-entry.js'",
  ]);
  assert.match(fs.readFileSync(path.join(out, 'style.css'), 'utf8'), /story-block\/src\/v2\/view\/host\.css/);
  assert.match(fs.readFileSync(path.join(out, 'BUILD.txt'), 'utf8'), new RegExp(`source commit: ${'a'.repeat(40)}`));
  assert.match(fs.readFileSync(path.join(out, 'entry.js'), 'utf8'), /source a{40}/);
  assert.equal(fs.readFileSync(path.join(out, 'story-block', 'src', 'look.css'), 'utf8'), '.look { color: red; }\n');
  assert.equal(fs.readFileSync(path.join(out, 'story-block', 'assets', 'font.woff2'), 'utf8'), 'font');
  assert.equal(fs.readFileSync(path.join(out, 'npc-state-delta', 'style.css'), 'utf8'), '.npc { color: blue; }\n');
  assert.equal(fs.readFileSync(path.join(out, 'ui', 'css', 'next-hide.css'), 'utf8'), '.next { display: none; }\n');
});

test('host imports gain one folder because each tool sits below the extension root', async () => {
  const bundle = fs.readFileSync(path.join(out, 'npc-state-delta', 'bootstrap.js'), 'utf8');
  assert.match(bundle, /from "\.\.\/\.\.\/\.\.\/\.\.\/extensions\.js"/);
  assert.doesNotMatch(bundle, /from "\.\.\/\.\.\/\.\.\/extensions\.js"/);
});

test('each bundle sits at its package root, so import.meta.url assets resolve in the copied folder', async () => {
  const bundle = fs.readFileSync(path.join(out, 'story-block', 'index.js'), 'utf8');
  assert.match(bundle, /new URL\("src\/asset\.js", import\.meta\.url\)/);
  assert.match(fs.readFileSync(path.join(out, 'ui', 'st-entry.js'), 'utf8'), /new URL\("\.\/", new URL\("st-entry\.js", import\.meta\.url\)\.href\)/);
  assert.ok(fs.existsSync(path.join(out, 'story-block', 'src', 'asset.js')) === false, 'source JS is not copied');
});

test('the four sets are the three packages and the preview, with no folder collisions', () => {
  assert.deepEqual(DIST_SETS.map(set => set.name), ['story-block', 'story-director', 'npc-state-delta', 'ui']);
  assert.equal(new Set(DIST_SETS.map(set => set.dir)).size, 4);
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
});

test('the install folder is an option: parseArgs reads it, and the host depth follows it', async () => {
  assert.equal(parseArgs(['--install-folder', 'x']).installFolder, 'x');
  const deeper = path.join(source, 'out-deep');
  await buildDist({ repo: source, commit: 'c'.repeat(40), source, out: deeper, write: false, installFolder: 'a/b' });
  assert.match(fs.readFileSync(path.join(deeper, 'npc-state-delta', 'bootstrap.js'), 'utf8'), /from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/extensions\.js"/);
});

test('the stylesheet imports the host stylesheet from where the source has it: the old package path, or ui/legacy after the move', async () => {
  const moved = fs.mkdtempSync(path.join(os.tmpdir(), 'play-dist-moved-'));
  try {
    for (const file of ['packages/story-block/index.js', 'packages/story-director/index.js', 'packages/npc-state-delta/bootstrap.js', 'ui/st-entry.js']) put(moved, file, '\n');
    put(moved, 'ui/legacy/view/host.css', '@import url(\'./glass.css\');\n');
    put(moved, 'ui/legacy/view/glass.css', '.glass { color: red; }\n');
    const to = path.join(moved, 'out');
    await buildDist({ repo: moved, commit: 'd'.repeat(40), source: moved, out: to, write: false });
    const style = fs.readFileSync(path.join(to, 'style.css'), 'utf8');
    assert.match(style, /@import url\('\.\/ui\/legacy\/view\/host\.css'\)/);
    assert.ok(fs.existsSync(path.join(to, 'ui/legacy/view/host.css')), 'the file the import names is copied');
    assert.ok(fs.existsSync(path.join(to, 'ui/legacy/view/glass.css')), 'and so is what it imports');
  } finally { fs.rmSync(moved, { recursive: true, force: true }); }
});
