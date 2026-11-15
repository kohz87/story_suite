import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, MAX_EXPORTS } from '../../scripts/codemap/build-map.mjs';

const SRC = {
  'core/pace/index.js': "export { partyPace } from './party-pace.js';\nexport { kindPace, WALK_PACE } from './kind-pace.js';\n",
  'core/pace/kind-pace.js': "export const WALK_PACE = 20;\nexport function kindPace(kind) {\n  return 30;\n}\n",
  'core/pace/party-pace.js': "import { kindPace } from './kind-pace.js';\nimport fs from 'node:fs';\nexport function partyPace(opts = {}) { return kindPace(); }\n",
  'tests/core/pace.test.js': "import { partyPace } from '../../core/pace/index.js';\nimport { kindPace } from '../../core/pace/kind-pace.js';\n",
};
const files = Object.keys(SRC);
const readSource = p => SRC[p];
const jobs = {
  'core/pace/index.js': 'Entry point of the pace module.',
  'core/pace/kind-pace.js': 'Daily pace for one kind of mount or vehicle.',
  'core/pace/party-pace.js': 'The party pace from members and transport.',
};

test('rows: one per file, sorted, with job, exports, internal imports, imported-by, lines and tests', () => {
  const { rows, problems } = buildMap({ files, readSource, jobs });
  assert.deepEqual(problems, []);
  assert.deepEqual(rows.map(r => r.path), files.slice().sort());
  const kind = rows.find(r => r.path === 'core/pace/kind-pace.js');
  assert.equal(kind.job, 'Daily pace for one kind of mount or vehicle.');
  assert.deepEqual(kind.exports, ['WALK_PACE', 'kindPace(kind)']);
  assert.deepEqual(kind.imports, []);
  assert.deepEqual(kind.importedBy, ['core/pace/index.js', 'core/pace/party-pace.js', 'tests/core/pace.test.js']);
  assert.equal(kind.lines, 4);
  assert.deepEqual(kind.tests, ['tests/core/pace.test.js']);
  const party = rows.find(r => r.path === 'core/pace/party-pace.js');
  assert.deepEqual(party.imports, ['core/pace/kind-pace.js']);
  assert.deepEqual(party.tests, []);
  const idx = rows.find(r => r.path === 'core/pace/index.js');
  assert.deepEqual(idx.imports, ['core/pace/kind-pace.js', 'core/pace/party-pace.js']);
  assert.deepEqual(idx.tests, ['tests/core/pace.test.js']);
});

test('lines counts a file without a final newline the same way', () => {
  const { rows } = buildMap({ files: ['a.js'], readSource: () => 'const a = 1;\nconst b = 2;', jobs: { 'a.js': 'x' } });
  assert.equal(rows[0].lines, 2);
});

test('test files need no job; their job reads "Tests for" what they import', () => {
  const { rows } = buildMap({ files, readSource, jobs });
  const t = rows.find(r => r.path === 'tests/core/pace.test.js');
  assert.equal(t.job, 'Tests for core/pace/index.js, core/pace/kind-pace.js.');
});

test('problems: missing job, empty job, job for an unknown file', () => {
  const { problems } = buildMap({ files, readSource, jobs: { ...jobs, 'core/pace/kind-pace.js': '  ', 'core/gone.js': 'Old file.' } });
  assert.deepEqual(problems, [
    'core/gone.js: has a job in docs/codemap/jobs.json but the file does not exist',
    'core/pace/kind-pace.js: no job sentence in docs/codemap/jobs.json',
  ]);
});

test('one job per file: more than MAX_EXPORTS exports is a problem, except an index.js that only re-exports', () => {
  assert.equal(MAX_EXPORTS, 4);
  const many = 'export const a=1;\nexport const b=2;\nexport const c=3;\nexport const d=4;\nexport function e() {}\n';
  const { problems } = buildMap({ files: ['core/many.js'], readSource: () => many, jobs: { 'core/many.js': 'Too much.' } });
  assert.deepEqual(problems, ['core/many.js: 5 exports (one job per file allows at most 4)']);
  const reex = Array.from({ length: 6 }, (_, i) => `export { f${i} } from './f${i}.js';`).join('\n');
  const r2 = buildMap({ files: ['core/index.js'], readSource: () => reex, jobs: { 'core/index.js': 'Entry.' } });
  assert.deepEqual(r2.problems, []);
});

test('test files are not held to the export limit', () => {
  const many = 'export const a=1;\nexport const b=2;\nexport const c=3;\nexport const d=4;\nexport const e=5;\n';
  const { problems } = buildMap({ files: ['tests/helpers/h.mjs'], readSource: () => many, jobs: {} });
  assert.deepEqual(problems, []);
});

test('a test file with its own job sentence keeps it instead of the generated one', () => {
  const { rows, problems } = buildMap({ files, readSource, jobs: { ...jobs, 'tests/core/pace.test.js': 'Pins the daily pace of each kind.' } });
  assert.equal(rows.find(r => r.path === 'tests/core/pace.test.js').job, 'Pins the daily pace of each kind.');
  assert.deepEqual(problems, []);
});
