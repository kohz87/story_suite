import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap } from '../../scripts/codemap/build-map.mjs';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';

const run = SRC => {
  const jobs = Object.fromEntries(Object.keys(SRC).map(p => [p, 'A job.']));
  return buildMap({ files: Object.keys(SRC), readSource: p => SRC[p], jobs }).problems;
};
const FOUR = 'export const a = 1, b = 2, c = 3, d = 4;\n';

test('a wildcard counts as the exports of its internal target', () => {
  const problems = run({ 'core/one.js': FOUR, 'core/main.js': "export * from './one.js';\nexport const e = 5;\n" });
  assert.deepEqual(problems, ['core/main.js: 5 exports (one job per file allows at most 4)']);
});

test('default is not re-exported by a wildcard, and cycles end', () => {
  const problems = run({
    'core/one.js': 'export const a = 1, b = 2, c = 3;\nexport default 1;\n',
    'core/main.js': "export * from './one.js';\nexport const d = 4, e = 5;\n",
    'core/loop.js': "export * from './loop2.js';\nexport const x = 1;\n",
    'core/loop2.js': "export * from './loop.js';\nexport const y = 1;\n",
  });
  assert.deepEqual(problems, ['core/main.js: 5 exports (one job per file allows at most 4)']);
});

test('an external or unresolvable wildcard cannot be counted and is an error', () => {
  const src = "export * from 'node:fs';\nexport * from './missing.js';\nexport const a = 1;\n";
  assert.deepEqual(run({ 'core/main.js': src }), [
    "core/main.js: export * from ./missing.js cannot be counted; list the names",
    "core/main.js: export * from node:fs cannot be counted; list the names",
  ]);
  assert.deepEqual(parseModule("export * from 'lodash';").exports[0].signature, "* from 'lodash'");
});

test('only a pure forwarding file is exempt from the limit', () => {
  const facade = "import { a } from './one.js';\nexport { a };\nexport * from './two.js';\nexport { b, c, d, e } from './one.js';\n";
  const two = 'export const f = 1, g = 2;\n';
  assert.deepEqual(run({ 'core/one.js': 'export const a=1,b=2,c=3,d=4,e=5;', 'core/two.js': two, 'core/f.js': facade }).filter(p => p.startsWith('core/f.js')), []);
  for (const extra of ['console.log(1);\n', 'const z = 1;\n', "import './side.js';\n", "import { q } from './one.js';\nq();\n"]) {
    const src = { 'core/one.js': FOUR, 'core/two.js': two, 'core/f.js': facade + extra, 'core/side.js': '' };
    assert.deepEqual(run(src).filter(p => p.startsWith('core/f.js')), ['core/f.js: 7 exports (one job per file allows at most 4)'], extra);
  }
});

test('a directive and comments keep the exemption', () => {
  const src = "'use strict';\n// forwards\nexport { a, b, c, d, e } from './one.js';\n";
  assert.deepEqual(run({ 'core/one.js': 'export const a=1,b=2,c=3,d=4;export const e=5;', 'core/f.js': src }).filter(p => p.startsWith('core/f.js')), []);
});

test('a name from two star sources is ambiguous and not counted; a shared origin is not ambiguous', () => {
  const problems = run({
    'core/one.js': 'export const a = 1, b = 2;\n',
    'core/two.js': 'export const a = 1, c = 3;\n',
    'core/main.js': "export * from './one.js';\nexport * from './two.js';\nexport const d = 4, e = 5;\n",
  });
  assert.deepEqual(problems, []);
  const diamond = run({
    'core/base.js': 'export const a = 1, b = 2, c = 3;\n',
    'core/l.js': "export * from './base.js';\n",
    'core/r.js': "export * from './base.js';\n",
    'core/main.js': "export * from './l.js';\nexport * from './r.js';\nexport const d = 4, e = 5;\n",
  });
  assert.deepEqual(diamond, ['core/main.js: 5 exports (one job per file allows at most 4)']);
  const local = run({
    'core/one.js': 'export const a = 1, b = 2;\n',
    'core/two.js': 'export const a = 1, c = 3;\n',
    'core/main.js': "export * from './one.js';\nexport * from './two.js';\nexport const a = 0, d = 4, e = 5;\n",
  });
  assert.deepEqual(local, ['core/main.js: 5 exports (one job per file allows at most 4)']);
});

test('JSX and TypeScript files are refused', () => {
  const files = ['a.ts', 'b.tsx', 'c.jsx', 'd.mts', 'e.cts'];
  const problems = run(Object.fromEntries(files.map(f => [`core/${f}`, 'export const a = 1;\n'])));
  for (const f of files) assert.ok(problems.includes(`core/${f}: JSX and TypeScript are not used in this repo`), f);
});
