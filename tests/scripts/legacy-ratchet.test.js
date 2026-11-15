import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLegacyRatchet } from '../../scripts/checks/legacy-ratchet.mjs';

const base = new Map([['a.js', 500], ['b.js', 600]]);

test('an identical or shrunken list passes', () => {
  assert.deepEqual(checkLegacyRatchet({ current: new Map(base), base }).errors, []);
  assert.deepEqual(checkLegacyRatchet({ current: new Map([['a.js', 480]]), base }).errors, []);
  assert.deepEqual(checkLegacyRatchet({ current: new Map(), base }).errors, []);
});

test('an added path is an error', () => {
  const current = new Map([['a.js', 500], ['new.js', 451]]);
  assert.deepEqual(checkLegacyRatchet({ current, base }).errors, ['new.js: added to the legacy list']);
});

test('a raised ceiling is an error', () => {
  const current = new Map([['a.js', 900], ['b.js', 600]]);
  assert.deepEqual(checkLegacyRatchet({ current, base }).errors, ['a.js: legacy ceiling raised from 500 to 900']);
});

test('both problems are reported, sorted', () => {
  const current = new Map([['z.js', 460], ['b.js', 601]]);
  assert.deepEqual(checkLegacyRatchet({ current, base }).errors, [
    'b.js: legacy ceiling raised from 600 to 601',
    'z.js: added to the legacy list',
  ]);
});

test('decideBase: fails closed except for the import commit without a list', async () => {
  const { decideBase, IMPORT_COMMIT } = await import('../../scripts/checks/legacy-ratchet.mjs');
  assert.deepEqual(decideBase({ ref: 'main', resolved: 'abc', read: { text: 'x 1' } }), { list: 'x 1' });
  assert.deepEqual(decideBase({ ref: 'c340', resolved: IMPORT_COMMIT, read: { missing: true } }), { skip: true });
  assert.match(decideBase({ ref: 'main', resolved: 'abc', read: { missing: true } }).error, /the base main has no legacy list/);
  assert.match(decideBase({ ref: 'nope', resolved: '', read: { error: 'bad ref' } }).error, /cannot read the base nope/);
  assert.match(decideBase({ ref: IMPORT_COMMIT, resolved: IMPORT_COMMIT, read: { error: 'io' } }).error, /cannot read/);
});
