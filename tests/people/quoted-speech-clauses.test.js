// F24: a quoted line keeps its own sentence breaks when a durable field is compacted ("Back room. Pay me tomorrow." is one line, not two clauses glued with "; ").
import test from 'node:test';
import assert from 'node:assert/strict';
import { compactDurableText } from '../../modules/people/core/core-relationship-text-parts/clauses.js';

test('a quoted line is not cut at its sentence break', () => {
  assert.equal(compactDurableText('Short, dry orders. "Back room. Pay me tomorrow."', 300), 'Short, dry orders. "Back room. Pay me tomorrow."');
  assert.equal(compactDurableText('Dry. Says “Back room. Pay me tomorrow.” and nods', 300), 'Dry.; Says “Back room. Pay me tomorrow.” and nods');
});

test('text outside quotes still splits into clauses as before', () => {
  assert.equal(compactDurableText('Short, dry orders. Hates fuss.', 300), 'Short, dry orders.; Hates fuss.');
});
