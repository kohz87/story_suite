import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropKnownProblems, failedTestFiles, splitApplyKnown } from '../../../scripts/codemod/apply-known.mjs';

const OUTPUT = 'test at tests/core/a.test.js:12:1\n✖ one\ntest at tests/core/a.test.js:40:1\ntest at tests/core/b.test.js:1:1\n';
const report = { stale: [{ file: 'p/a.js', value: 'src/x.js' }, { file: 'p/b.js', value: 'src/y.js' }] };

test('the failing test files are read from the node --test output once each', () => {
  assert.deepEqual(failedTestFiles(OUTPUT), ['tests/core/a.test.js', 'tests/core/b.test.js']);
});

test('listed stale strings and failing tests are set aside, new ones are kept, unused lines are named', () => {
  const lines = ['stale p/a.js src/x.js', 'test tests/core/a.test.js', 'test tests/core/gone.test.js'];
  const split = splitApplyKnown(report, { status: 1, output: OUTPUT }, lines);
  assert.deepEqual(split.stale, [{ file: 'p/b.js', value: 'src/y.js' }]);
  assert.deepEqual(split.tests, ['tests/core/b.test.js']);
  assert.deepEqual(split.unused, ['test tests/core/gone.test.js']);
});

test('a failing run that names no file is never covered; a passing run is clean', () => {
  assert.deepEqual(splitApplyKnown({ stale: [] }, { status: 1, output: 'boom' }, ['test x']).tests, ['(a test run failed and named no file)']);
  assert.deepEqual(splitApplyKnown({ stale: [] }, { status: 0, output: '' }, []).tests, []);
});

test('a verify problem is dropped only when a stale line names that file and value', () => {
  const problems = ['p/a.js: package-relative string "src/x.js" would go stale', 'p/a.js: package-relative string "src/z.js" would go stale', 'p/c.js: content line changed: x'];
  const { fresh, covered } = dropKnownProblems(problems, ['stale p/a.js src/x.js']);
  assert.equal(covered, 1);
  assert.deepEqual(fresh, problems.slice(1));
});
