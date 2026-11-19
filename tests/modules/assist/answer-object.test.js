import test from 'node:test';
import assert from 'node:assert/strict';
import { answerText } from '../../../modules/assist/st-adapter-parts/call.js';
import { parsePrecheck } from '../../../modules/rpg/board/precheck.js';

// The owner's proxy (19 Nov) handed the pre-check's JSON answer back as an object in `content`; it was read as '' and the fight never started.
const groups = { groups: [{ name: 'aggressive rats', count: 12, level: 1, tier: 'mob' }] };

test('an answer whose content is already parsed JSON is read as its JSON text', () => {
  assert.equal(answerText({ content: groups }), JSON.stringify(groups));
  assert.equal(answerText({ choices: [{ message: { content: groups } }] }), JSON.stringify(groups));
  assert.deepEqual(parsePrecheck(answerText({ content: groups })), groups.groups);
});

test('text answers are unchanged; nothing readable is still empty', () => {
  assert.equal(answerText('plain'), 'plain');
  assert.equal(answerText({ content: 'x' }), 'x');
  assert.equal(answerText({ content: null }), '');
  assert.equal(answerText(null), '');
});

test('the pre-check parser takes an already parsed answer too', () => {
  assert.deepEqual(parsePrecheck(groups), groups.groups);
  assert.deepEqual(parsePrecheck(groups.groups), groups.groups);
  assert.equal(parsePrecheck({ other: 1 }), null);
});
