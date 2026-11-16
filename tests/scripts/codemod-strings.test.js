import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteStrings } from '../../scripts/codemod/rewrite-strings.mjs';
import { buildPlan, makeMapper } from '../../scripts/codemod/plan.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';

const rules = parseRules({ area: 's', rules: [
  { from: 'packages/sb/src/v2/store', to: 'core/store', stem: true },
  { from: 'packages/sb/tests/v2', to: 'tests/core' },
  { from: 'packages/sb/src/gone', to: null },
] });
const files = new Set(['packages/sb/src/v2/store.js', 'packages/sb/src/v2/store/a.js', 'packages/sb/tests/v2/a.test.js', 'packages/sb/tests/v2/fixtures/f.json', 'packages/sb/src/gone/g.js', 'docs/x.md']);
const mapper = makeMapper(buildPlan([...files], [rules]), [rules]);
const run = (source, oldFile, newFile = oldFile) => rewriteStrings(source, { oldFile, newFile, files, mapper });

test('codemap job keys are renamed, deleted keys dropped, order and format kept', () => {
  const json = `${JSON.stringify({ 'docs/x.md': 'keep', 'packages/sb/src/v2/store.js': 'The store.', 'packages/sb/src/gone/g.js': 'Gone.' }, null, 2)}\n`;
  const out = run(json, 'docs/codemap/jobs-story-block.json');
  assert.deepEqual(Object.keys(JSON.parse(out.source)), ['docs/x.md', 'core/store.js']);
  assert.ok(out.source.endsWith('}\n'));
  assert.equal(out.changed, 2);
  assert.equal(run(json.replace(/packages[^"]*"/g, 'z"'), 'docs/codemap/jobs.json').changed, 0);
});

test('legacy-oversize lines and package bullets (relative to the package) are rewritten', () => {
  const list = '# out of packages/.\npackages/sb/tests/v2/a.test.js 700\ndocs/x.md 600\n';
  assert.equal(run(list, 'docs/merge/legacy-oversize.txt').source, '# out of packages/.\ntests/core/a.test.js 700\ndocs/x.md 600\n');
  const bullets = '- `src/v2/store.js`: the store.\n- `src/v2/store/a.js`: part.\n- `docs/x.md`: kept.\n';
  const out = run(bullets, 'packages/sb/docs/dev/codemap.md');
  assert.match(out.source, /`\.\.\/\.\.\/core\/store\.js`/);
});

test('globs in CI files and JS literals are rewritten without touching other text', () => {
  const ci = '  paths:\n    - "packages/sb/tests/v2/**"\n    - packages/sb/src/v2/store-parts/*.js\n    - README.md\n';
  const out = run(ci, '.github/workflows/ci.yml');
  assert.match(out.source, /"tests\/core\/\*\*"/);
  assert.match(out.source, /core\/store-parts\/\*\.js/);
  assert.match(out.source, /README\.md/);
});

test('JS literals: root paths and relative paths are rewritten, prose and unknown paths are not', () => {
  const src = "const a = 'packages/sb/tests/v2/fixtures/f.json';\nconst b = '../v2/fixtures/f.json';\nconst c = 'a/b and c/d';\nconst d = 'src/other/x.js';\nimport q from './z.js';\n";
  const out = run(src, 'packages/sb/tests/v2/a.test.js', 'tests/core/a.test.js');
  assert.match(out.source, /a = 'tests\/core\/fixtures\/f\.json'/);
  assert.match(out.source, /c = 'a\/b and c\/d'/);
  assert.match(out.source, /d = 'src\/other\/x\.js'/);
  assert.match(out.source, /from '\.\/z\.js'/);
  const rel = "const r = path.join(import.meta.dirname, './fixtures/f.json');\n";
  assert.match(run(rel, 'packages/sb/tests/v2/a.test.js', 'tests/core/a.test.js').source, /'\.\/fixtures\/f\.json'/);
});

test('a relative literal in a moved file is re-based even when its target stays', () => {
  const out = run("const r = '../../../../docs/x.md';\n", 'packages/sb/tests/v2/a.test.js', 'tests/core/a.test.js');
  assert.equal(out.source, "const r = '../../docs/x.md';\n");
});

test('files outside every site are untouched and unparsable JS is reported', () => {
  assert.equal(run('hello packages/sb/tests/v2\n', 'notes.txt').changed, 0);
  assert.ok(run('const = ;', 'x/y.js').error);
});
