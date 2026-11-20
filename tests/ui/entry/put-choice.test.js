import test from 'node:test';
import assert from 'node:assert/strict';
import { putChoice } from '../../../ui/entry/put-choice.js';

const page = value => {
  const events = [];
  const box = { value, focused: 0, dispatchEvent: e => events.push(e.type), focus() { this.focused += 1; } };
  return { doc: { querySelector: s => (s === '#send_textarea' ? box : null), defaultView: { Event: class { constructor(type) { this.type = type; } } } }, box, events };
};

// Owner, 20 Nov: "if I click another choice, it doesn't append but wipe out everything in the box".
test('a choice fills an empty box, and a second choice is added on its own line', () => {
  const { doc, box, events } = page('');
  putChoice(doc, 'Ask about the ledger.');
  assert.equal(box.value, 'Ask about the ledger.');
  putChoice(doc, 'Offer the coin back.');
  assert.equal(box.value, 'Ask about the ledger.\nOffer the coin back.');
  assert.deepEqual(events, ['input', 'input']);
});

test('words the reader typed stay, and the same choice twice is not added again', () => {
  const { doc, box, events } = page('I glance at the door.  \n');
  putChoice(doc, 'Leave quietly.');
  assert.equal(box.value, 'I glance at the door.\nLeave quietly.');
  putChoice(doc, 'Leave quietly.');
  assert.equal(box.value, 'I glance at the door.\nLeave quietly.');
  assert.equal(events.length, 1);
  assert.equal(box.focused, 2);
});

test('no message box on the page: nothing happens', () => {
  assert.doesNotThrow(() => putChoice({ querySelector: () => null }, 'x'));
});
