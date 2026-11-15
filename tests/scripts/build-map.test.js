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

test('one job per file: more than MAX_EXPORTS exports is a problem, except a file that only re-exports', () => {
  assert.equal(MAX_EXPORTS, 4);
  const many = 'export const a=1;\nexport const b=2;\nexport const c=3;\nexport const d=4;\nexport function e() {}\n';
  const { problems } = buildMap({ files: ['core/many.js'], readSource: () => many, jobs: { 'core/many.js': 'Too much.' } });
  assert.deepEqual(problems, ['core/many.js: 5 exports (one job per file allows at most 4)']);
  const reex = Array.from({ length: 6 }, (_, i) => `export { f${i} } from './f${i}.js';`).join('\n');
  const r2 = buildMap({ files: ['core/index.js'], readSource: () => reex, jobs: { 'core/index.js': 'Entry.' } });
  assert.deepEqual(r2.problems, []);
  const facade = buildMap({ files: ['core/facade.js'], readSource: () => reex, jobs: { 'core/facade.js': 'Kept for old imports.' } });
  assert.deepEqual(facade.problems, []);
  const mixed = `${reex}\nexport const own = 1;`;
  const r3 = buildMap({ files: ['core/index.js'], readSource: () => mixed, jobs: { 'core/index.js': 'Entry.' } });
  assert.deepEqual(r3.problems, ['core/index.js: 7 exports (one job per file allows at most 4)']);
});

test('CommonJS and unparsable files are problems', () => {
  const run = src => buildMap({ files: ['a.js'], readSource: () => src, jobs: { 'a.js': 'x' } }).problems;
  const cjs = 'a.js: uses the name module, exports, require, __filename or __dirname (CommonJS is not allowed here; rename it)';
  assert.deepEqual(run('module.exports = {a:1,b:2,c:3,d:4,e:5};'), [cjs]);
  assert.deepEqual(run('Object.assign(exports, {a:1,b:2,c:3,d:4,e:5});'), [cjs]);
  assert.deepEqual(run('module.exports = {...{a:1,b:2,c:3,d:4,e:5}};'), [cjs]);
  assert.deepEqual(run('exports.a = 1;'), [cjs]);
  assert.deepEqual(run("exports['a'] = 1;"), [cjs]);
  assert.deepEqual(run('export const = ;'), ['a.js: cannot be parsed as an ES module']);
});

test('test files are not held to the export limit', () => {
  const many = 'export const a=1;\nexport const b=2;\nexport const c=3;\nexport const d=4;\nexport const e=5;\n';
  const { problems } = buildMap({ files: ['tests/helpers/h.mjs'], readSource: () => many, jobs: {} });
  assert.deepEqual(problems, []);
});

const runFiles = SRC => {
  const jobs = Object.fromEntries(Object.keys(SRC).filter(p => !p.startsWith('tests/') && /\.(?:m?js|cjs|sh|bash|py)$/.test(p)).map(p => [p, 'A job.']));
  return buildMap({ files: Object.keys(SRC), readSource: p => SRC[p], jobs }).problems;
};

test('.cjs files and require/__filename/__dirname are refused outside packages', () => {
  assert.deepEqual(runFiles({ 'core/a.cjs': 'const x = 1;\n' }), ['core/a.cjs: CommonJS is not allowed here']);
  assert.match(runFiles({ 'core/cache.js': 'require.cache[__filename].exports = {};\n' })[0], /CommonJS is not allowed here/);
  assert.match(runFiles({ 'core/d.js': 'export const d = __dirname;\n' })[0], /CommonJS is not allowed here/);
});

test('a source file in an unused language is a problem; allowed scripts and plain text are not', () => {
  assert.deepEqual(runFiles({ 'scripts/x.pl': 'print 1;\n', 'scripts/y.rb': 'puts 1\n' }), [
    'scripts/x.pl: this language is not used in this repo',
    'scripts/y.rb: this language is not used in this repo',
  ]);
  assert.deepEqual(runFiles({ 'scripts/run': '#!/bin/sh\necho\n' }), ['scripts/run: files need an extension here']);
  const ok = { 'scripts/a.sh': 'echo 1\n', 'scripts/b.bash': 'echo 1\n', 'scripts/c.py': 'print(1)\n', 'Makefile': 'text\n', '.gitignore': 'x\n' };
  assert.deepEqual(runFiles(ok), []);
});

test('test files skip only the export cap: stars, CommonJS names and JSX/TS still fail', () => {
  assert.deepEqual(runFiles({ 'tests/helpers/probe.mjs': 'export const a=1,b=2,c=3,d=4,e=5;\n' }), []);
  assert.deepEqual(runFiles({ 'tests/helpers/s.mjs': "export * from 'node:fs';\nexport const extra = 1;\n" }), [
    'tests/helpers/s.mjs: export * from node:fs cannot be counted; list the names',
  ]);
  assert.match(runFiles({ 'tests/x.test.js': 'module.exports = {};\n' })[0], /CommonJS is not allowed here/);
  assert.equal(runFiles({ 'tests/x.test.tsx': 'export {};\n' })[0], 'tests/x.test.tsx: JSX and TypeScript are not used in this repo');
});
