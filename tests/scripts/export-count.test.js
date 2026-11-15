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

test('an external or unresolvable wildcard counts as one and is listed', () => {
  const src = "export * from 'lodash';\nexport * from './missing.js';\nexport const a = 1, b = 2, c = 3;\n";
  assert.deepEqual(run({ 'core/main.js': src }), ['core/main.js: 5 exports (one job per file allows at most 4)']);
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

test('TypeScript files are refused', () => {
  const problems = run({ 'core/a.ts': 'export const a: number = 1;\n', 'core/b.tsx': 'export const b = 1;\n' });
  assert.ok(problems.includes('core/a.ts: TypeScript is not used in this repo'));
  assert.ok(problems.includes('core/b.tsx: TypeScript is not used in this repo'));
});
