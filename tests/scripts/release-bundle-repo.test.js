import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { walkBundle } from '../../scripts/release/graph.mjs';

// A file of any source root of the repo is bundled into the package's bundle; only what leaves the repo (or is a host file) stays external.
let root;
const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const read = (out, file) => fs.readFileSync(path.join(out, file), 'utf8');
// 'src/v2/store.js' is the old-layout name of core/store.js: the lazy list names it the old way and the checkout has the new layout.
const SET = { name: 'story-block', dir: 'packages/story-block', entries: ['boot.js'], lazy: ['src/v2/store.js'] };

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-bundle-repo-'));
  write('packages/story-block/boot.js', [
    "import { helper } from '../../core/helper.js';",
    "import { host } from '../../../extensions.js';",
    "export const eager = () => import('../../core/eager.js');",
    "export const lazy = () => import('../../core/store.js');",
    "export const both = [helper, host];",
  ].join('\n'));
  write('core/helper.js', "export const helper = new URL('./asset.txt', import.meta.url).href;\n");
  write('core/eager.js', 'export const answer = 42;\n');
  write('core/store.js', 'export const later = 7;\n');
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('a file of the repo-root core/ is packed into the bundle, not left as an import of its absolute path', async () => {
  const out = path.join(root, 'out1');
  await buildBundleSet(SET, out, root);
  const graph = walkBundle(out, 'boot.js');
  assert.deepEqual(graph.missing, []);
  assert.deepEqual(graph.host, ['../../../extensions.js']);
  assert.ok(!read(out, 'boot.js').includes(root));
  assert.match(read(out, 'boot.js'), /answer/, 'the eager dynamic import is packed into the entry');
});

test('the lazy list names a file the old way and it is still its own chunk after the move', async () => {
  const out = path.join(root, 'out2');
  await buildBundleSet(SET, out, root);
  const graph = walkBundle(out, 'boot.js');
  assert.equal(graph.lazy.length, 1);
  assert.match(read(out, graph.lazy[0]), /later/);
});

test('import.meta.url keeps the original location of a moved file, and two builds are the same bytes', async () => {
  const a = path.join(root, 'out3');
  const b = path.join(root, 'out4');
  const files = await buildBundleSet(SET, a, root);
  await buildBundleSet(SET, b, root);
  assert.match(read(a, 'boot.js'), /new URL\("\.\.\/\.\.\/core\/helper\.js", import\.meta\.url\)/);
  for (const file of files) assert.equal(read(a, file), read(b, file));
});
