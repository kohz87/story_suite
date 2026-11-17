import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LISTS, addedEntries, staleEntries } from '../../scripts/b4/shrink.mjs';

test('addedEntries ignores comments and blanks and reports only new entries', () => {
  const base = '# head\na.js :: x\n\nb.js 500\n';
  assert.deepEqual(addedEntries(base, '# changed head\nb.js 500\n'), []);
  assert.deepEqual(addedEntries(base, 'a.js :: x\nb.js 501\nc.js :: y\n'), ['b.js 501', 'c.js :: y']);
  assert.deepEqual(addedEntries(undefined, 'a.js\n'), ['a.js']);
});

test('staleEntries finds entries that name a removed file or a file under a removed dir', () => {
  const removed = { files: new Set(['ui/legacy/x.js']), dirs: ['ui/legacy/view/'] };
  const text = '# c\nui/legacy/x.js :: a\nui/legacy/view/y.js 600\nui/legacy/keep.js :: b\n';
  assert.deepEqual(staleEntries(text, removed), ['ui/legacy/x.js :: a', 'ui/legacy/view/y.js 600']);
});

test('the grow-only removed-exports list and the layout lists that B4-12 owns are not shrink lists', () => {
  assert.ok(!LISTS.some(l => l.includes('removed-exports') || l.includes('layout-old') || l.includes('layout-known')));
  assert.ok(LISTS.includes('docs/merge/core-module-refs.txt'));
});
