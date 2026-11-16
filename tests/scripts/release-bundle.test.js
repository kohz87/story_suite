import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { walkBundle } from '../../scripts/release/graph.mjs';

let root;
const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const SET = { name: 'demo', dir: 'pkg/demo', entries: ['boot.js'], lazy: ['lazy.js'] };

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-bundle-'));
  write('pkg/demo/boot.js', [
    "import { shared } from './shared.js';",
    "import { host } from '../../../extensions.js';",
    "export const eager = () => import('./eager.js');",
    "export const lazy = () => import('./lazy.js');",
    "export const abs = () => import('/script.js');",
    "export const both = [shared, host];",
  ].join('\n'));
  write('pkg/demo/shared.js', 'export const shared = 1;\n');
  write('pkg/demo/eager.js', "import { shared } from './shared.js';\nexport const answer = shared + 1;\n");
  write('pkg/demo/lazy.js', "import { shared } from './shared.js';\nexport const later = shared + 2;\n");
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('a bundle set builds with source maps, and the lazy module stays a separate chunk', async () => {
  const out = path.join(root, 'out1');
  const files = await buildBundleSet(SET, out, root);
  assert.ok(files.includes('boot.js') && files.includes('boot.js.map'));
  const graph = walkBundle(out, 'boot.js');
  assert.equal(graph.lazy.length, 1);
  assert.match(fs.readFileSync(path.join(out, graph.lazy[0]), 'utf8'), /later/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'boot.js'), 'utf8'), /import\("\.\/eager/);
});

test('every import() in the bundle resolves, and host specifiers stay as the host expects them', async () => {
  const out = path.join(root, 'out2');
  await buildBundleSet(SET, out, root);
  const graph = walkBundle(out, 'boot.js');
  assert.deepEqual(graph.missing, []);
  assert.deepEqual(graph.host, ['../../../extensions.js', '/script.js']);
});

test('two builds of the same source are byte-identical', async () => {
  const a = path.join(root, 'det-a');
  const b = path.join(root, 'det-b');
  const filesA = await buildBundleSet(SET, a, root);
  const filesB = await buildBundleSet(SET, b, root);
  assert.deepEqual(filesA, filesB);
  for (const file of filesA) assert.ok(fs.readFileSync(path.join(a, file)).equals(fs.readFileSync(path.join(b, file))), file);
});

test('the walk reports an import() whose chunk is missing', async () => {
  const out = path.join(root, 'out3');
  await buildBundleSet(SET, out, root);
  const lazyFile = walkBundle(out, 'boot.js').lazy[0];
  fs.rmSync(path.join(out, lazyFile));
  assert.equal(walkBundle(out, 'boot.js').missing.length, 1);
});
