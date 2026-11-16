import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRules, matchPath, parseRules } from '../../scripts/codemod/rules.mjs';

const set = parseRules({
  area: 'a',
  rules: [
    { from: 'p/store', to: 'core/store', stem: true },
    { from: 'p/store/old', to: 'core/legacy' },
    { from: 'p/gone', to: null },
  ],
});

test('stem moves x.js, x/ and x-parts/ together but not a longer name', () => {
  assert.equal(matchPath(set.rules, 'p/store.js').to, 'core/store.js');
  assert.equal(matchPath(set.rules, 'p/store/a.js').to, 'core/store/a.js');
  assert.equal(matchPath(set.rules, 'p/store-parts/b.js').to, 'core/store-parts/b.js');
  assert.equal(matchPath(set.rules, 'p/storeroom.js'), null);
});

test('the longest prefix wins and null means delete', () => {
  assert.equal(matchPath(set.rules, 'p/store/old/x.js').to, 'core/legacy/x.js');
  assert.equal(matchPath(set.rules, 'p/gone/x.js').to, null);
  assert.equal(matchPath(set.rules, 'p/elsewhere.js'), null);
});

test('a non-stem rule does not take x.js', () => {
  const plain = parseRules({ area: 'b', rules: [{ from: 'p/x', to: 'q/x' }] });
  assert.equal(matchPath(plain.rules, 'p/x.js'), null);
});

test('equal-length rules cannot both match: duplicates are refused, near names stay apart', () => {
  const tied = { rules: [{ from: 'p/x', to: 'a', stem: true }, { from: 'p/x', to: 'b' }] };
  assert.throws(() => parseRules({ area: 'c', ...tied }), /duplicate/);
  const near = parseRules({ area: 'c', rules: [{ from: 'p/x', to: 'a' }, { from: 'p/y', to: 'b' }] });
  assert.equal(matchPath(near.rules, 'p/x/f.js').to, 'a/f.js');
});

test('validation rejects bad rule files and loadRules reads a file', () => {
  assert.throws(() => parseRules({ rules: [] }), /area/);
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'p/', to: 'q' }] }), /from/);
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'p', to: 3 }] }), /to/);
  assert.throws(() => parseRules({ area: 'a', rules: [], scope: 'x' }), /scope/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  fs.writeFileSync(path.join(dir, 'a.rules.json'), JSON.stringify({ area: 'a', rules: [{ from: 'p', to: 'q' }] }));
  assert.equal(loadRules(path.join(dir, 'a.rules.json')).rules[0].to, 'q');
});
