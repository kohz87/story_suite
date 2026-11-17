import test from 'node:test';
import assert from 'node:assert/strict';
import { showSourceTag } from '../../../ui/kit/source-tag.js';

test('a leading tag reads as the message number', () => {
  assert.equal(showSourceTag('[m12] she laughed'), '#12 — she laughed');
  assert.equal(showSourceTag('[m3]She nodded'), '#3 — She nodded');
  assert.equal(showSourceTag('[m7]'), '#7');
});

test('no tag, or a tag mid-text, is left alone', () => {
  assert.equal(showSourceTag('she laughed'), 'she laughed');
  assert.equal(showSourceTag('she said [m12] and left'), 'she said [m12] and left');
  assert.equal(showSourceTag(null), '');
});

test('only the leading tag changes when several are written', () => {
  assert.equal(showSourceTag('[m4] one [m5] two'), '#4 — one [m5] two');
});
