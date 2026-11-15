import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devMapJobs } from '../../scripts/codemap/dev-map-jobs.mjs';
import { packageMap } from '../../scripts/codemap/package-map.mjs';

const P = 'packages/demo/';
const SRC = {
  [`${P}src/a.js`]: '// Header job of a.\nexport const A = 1, B = 2;\nexport function f(x = /^(?:a|b)/) { return x; }\n',
  [`${P}src/b.js`]: 'export const b = 1;\n',
  [`${P}src/many.js`]: 'export const a = 1, b = 2, c = 3, d = 4, e = 5;\n',
  [`${P}src/facade.js`]: "export * from './many.js';\nexport { A, B } from './a.js';\n",
  [`${P}tests/a.test.js`]: "import { A } from '../src/a.js';\n",
  [`${P}tests/helper.js`]: "import { b } from '../src/b.js';\nexport const h = b;\n",
};
const base = {
  pkg: 'demo',
  files: Object.keys(SRC),
  readSource: p => SRC[p],
  explicitJobs: { 'src/b.js': 'Explicit b.' },
  devMapText: '# Map\n- `src/many.js`: Hand-written many.\n- `src/facade.js`: Forwards the many and a parts.\n- `src/gone.js`: Not a file any more.\n',
  features: [{ name: 'Alpha', entry: 'src/a.js', about: 'The a | b thing.' }],
};
const build = over => packageMap({ ...base, ...over });

test('one row per file, tests and helpers included, with paths relative to the package', () => {
  const { markdown, problems } = build({});
  assert.deepEqual(problems, []);
  for (const rel of Object.keys(SRC)) assert.ok(markdown.includes(`| \`${rel.slice(P.length)}\` |`), rel);
  assert.match(markdown, /\| `tests\/a\.test\.js` \| Tests for src\/a\.js\./);
  assert.match(markdown, /\| `tests\/helper\.js` \| Tests for src\/b\.js\./);
});

test('adding, changing or removing a test file changes the map', () => {
  const before = build({}).markdown;
  assert.notEqual(build({ files: base.files.filter(f => !f.endsWith('a.test.js')) }).markdown, before);
  const edited = { ...SRC, [`${P}tests/a.test.js`]: "import { A } from '../src/a.js';\nimport { b } from '../src/b.js';\n" };
  assert.notEqual(build({ readSource: p => edited[p] }).markdown, before);
  const added = { ...SRC, [`${P}tests/new.test.js`]: "import { b } from '../src/b.js';\n" };
  assert.notEqual(build({ files: Object.keys(added), readSource: p => added[p] }).markdown, before);
});

test('job order: explicit file, then the dev map, then the opening comment', () => {
  const { markdown } = build({});
  assert.match(markdown, /\| `src\/b\.js` \| Explicit b\. \|/);
  assert.match(markdown, /\| `src\/many\.js` \| Hand-written many\. \|/);
  assert.match(markdown, /\| `src\/a\.js` \| Header job of a\. \|/);
});

test('a source file with no job is a problem, not a placeholder', () => {
  const { markdown, problems } = build({ explicitJobs: {} });
  assert.deepEqual(problems, [`${P}src/b.js: no job sentence in docs/codemap/jobs-demo.json`]);
  assert.ok(!markdown.includes('no opening comment'));
});

test('an explicit job for a file that does not exist is a problem; a stale dev-map bullet is ignored', () => {
  const { problems } = build({ explicitJobs: { 'src/b.js': 'B.', 'src/zzz.js': 'Z.' } });
  assert.deepEqual(problems, [`${P}src/zzz.js: has a job in docs/codemap/jobs-demo.json but the file does not exist`]);
});

test('backlog counts bindings (multi-binding declarations, wildcards) and exempts facades', () => {
  const { markdown, backlog } = build({});
  assert.equal(backlog, 1);
  assert.match(markdown, /1 file with more than 4 exports/);
  assert.match(markdown, /- `src\/many\.js`: 5 exports/);
  assert.ok(!markdown.includes('`src/facade.js`: '));
  assert.match(markdown, /\| `src\/a\.js` \|[^\n]*`A`<br>`B`<br>`f\(x = \/\^\(\?:a\\\|b\)\/\)`/);
});

test('every table row keeps its columns when a signature holds a pipe', () => {
  const row = build({}).markdown.split('\n').find(l => l.startsWith('| `src/a.js`'));
  assert.equal(row.replaceAll('\\|', '').split('|').length, 9);
});

test('the feature index lists entries and reports one that is not a file', () => {
  assert.match(build({}).markdown, /## Feature entry points[\s\S]*\| Alpha \| `src\/a\.js` \| The a \\\| b thing\. \|/);
  const bad = build({ features: [{ name: 'Beta', entry: 'src/nope.js', about: 'x' }] });
  assert.deepEqual(bad.problems, ['docs/codemap/features-demo.json: feature "Beta" points at src/nope.js, which is not a file in the map']);
  assert.deepEqual(build({ features: [] }).problems, ['docs/codemap/features-demo.json: no feature entry points listed']);
});

test('devMapJobs reads bullets and ignores prose', () => {
  assert.deepEqual(devMapJobs('Intro.\n- `a/b.js`: One. Two.\n- not a bullet\n- `c.css`: Style.\n'), { 'a/b.js': 'One. Two.', 'c.css': 'Style.' });
  assert.deepEqual(devMapJobs(''), {});
});

test('the provenance line names where package jobs come from', () => {
  assert.match(build({}).markdown, /from each file's job sentence \(docs\/codemap\/jobs-demo\.json, the package's docs\/dev\/codemap\.md, or the file's opening comment\)/);
});
