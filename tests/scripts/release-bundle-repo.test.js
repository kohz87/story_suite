import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { walkBundle } from '../../scripts/release/graph.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

// A file of any source root of the repo is bundled into the package's bundle; only what leaves the repo (or is a host file) stays external.
let root;
const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const read = (out, file) => fs.readFileSync(path.join(out, file), 'utf8');
const SET = { name: 'suite', entries: ['boot.js'], lazy: ['core/store.js'] };

before(() => {
  root = tempDir('release-bundle-repo-');
  write('boot.js', [
    "import { helper } from './core/helper.js';",
    "import { host } from '../../../extensions.js';",
    "export const eager = () => import('./core/eager.js');",
    "export const lazy = () => import('./core/store.js');",
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

test('a module on the lazy list is its own chunk', async () => {
  const out = path.join(root, 'out2');
  await buildBundleSet(SET, out, root);
  const graph = walkBundle(out, 'boot.js');
  assert.equal(graph.lazy.length, 1);
  assert.match(read(out, graph.lazy[0]), /later/);
});

test('import.meta.url names the file from the extension folder, and two builds are the same bytes', async () => {
  const a = path.join(root, 'out3');
  const b = path.join(root, 'out4');
  const files = await buildBundleSet(SET, a, root);
  await buildBundleSet(SET, b, root);
  assert.match(read(a, 'boot.js'), /new URL\("core\/helper\.js", import\.meta\.url\)/);
  for (const file of files) assert.equal(read(a, file), read(b, file));
});

// A host import is written for the file that carries it: the extension folder is the repo root, so a file in modules/people/legacy/ needs
// five ../ to reach third-party/ and one more for scripts/. The bundle rewrites each from the extension folder, where the chunks sit.
test('a host import resolves from the file\'s own folder, whatever its depth', async () => {
  write('modules/people/legacy/bootstrap.js', "import './../settings/runtime-settings-parts/save.js';\nimport { ext } from '../../../../../../extensions.js';\nexport const both = [ext];\n");
  write('modules/people/settings/runtime-settings-parts/save.js', "import { ext } from '../../../../../../../extensions.js';\nexport const save = ext;\n");
  const out = path.join(root, 'out5');
  await buildBundleSet({ name: 'suite', entries: ['modules/people/legacy/bootstrap.js'], lazy: [] }, out, root);
  const graph = walkBundle(out, 'bootstrap.js');
  assert.deepEqual(graph.missing, []);
  // legacy/ is 3 folders down (6 up reaches scripts/); runtime-settings-parts/ is 4 down (7 up): both name /scripts/extensions.js
  assert.deepEqual(graph.host, ['../../../extensions.js']);
});
