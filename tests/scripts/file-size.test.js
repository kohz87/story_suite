import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSizes, parseLegacyList, LINE_LIMIT } from '../../scripts/checks/file-size.mjs';

test('the limit is 450 lines', () => { assert.equal(LINE_LIMIT, 450); });

test('parseLegacyList reads "path count" lines, skipping comments and blanks', () => {
  const m = parseLegacyList('# legacy files over 450 lines\n\npackages/a/big.js 812\npackages/b/huge.test.js\t3837\n');
  assert.equal(m.size, 2);
  assert.equal(m.get('packages/a/big.js'), 812);
  assert.equal(m.get('packages/b/huge.test.js'), 3837);
});

test('a new file over the limit fails; at the limit passes', () => {
  const r = checkSizes({ files: [{ path: 'core/x.js', lines: 451 }, { path: 'core/y.js', lines: 450 }], legacy: new Map() });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /^core\/x\.js: 451 lines \(limit 450\)/);
});

test('a listed legacy file may stay or shrink but never grow', () => {
  const legacy = new Map([['packages/a/big.js', 800]]);
  assert.deepEqual(checkSizes({ files: [{ path: 'packages/a/big.js', lines: 800 }], legacy }).errors, []);
  assert.deepEqual(checkSizes({ files: [{ path: 'packages/a/big.js', lines: 700 }], legacy }).errors, []);
  const grew = checkSizes({ files: [{ path: 'packages/a/big.js', lines: 801 }], legacy }).errors;
  assert.equal(grew.length, 1);
  assert.match(grew[0], /^packages\/a\/big\.js: grew from 800 to 801 lines/);
});

test('a listed file now within the limit must leave the list', () => {
  const r = checkSizes({ files: [{ path: 'packages/a/big.js', lines: 300 }], legacy: new Map([['packages/a/big.js', 800]]) });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /^packages\/a\/big\.js: now 300 lines; remove it from the legacy list/);
});

test('a listed file that no longer exists must leave the list', () => {
  const r = checkSizes({ files: [], legacy: new Map([['packages/gone.js', 900]]) });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /^packages\/gone\.js: listed in the legacy list but missing/);
});

test('errors come out sorted by path', () => {
  const r = checkSizes({ files: [{ path: 'b.js', lines: 500 }, { path: 'a.js', lines: 500 }], legacy: new Map() });
  assert.deepEqual(r.errors.map(e => e.split(':')[0]), ['a.js', 'b.js']);
});
