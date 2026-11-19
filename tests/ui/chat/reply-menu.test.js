import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { replyMenuButton, replySheet } from '../../../ui/chat/reply-menu.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

test('button is labelled and calls onOpen', () => {
  installFakeDom();
  let hit = 0;
  const b = replyMenuButton({ onOpen: () => { hit += 1; } });
  assert.equal(b.getAttribute('aria-label'), 'Story Suite: this reply');
  assert.equal(b.getAttribute('title'), 'Story Suite: this reply');
  b.click();
  assert.equal(hit, 1);
  replyMenuButton().click();
});

test('the sheet keeps its actions only: Re-read, Discard repair (the undo) and Open Suite; its change list is the card\'s Changes tab', () => {
  installFakeDom();
  const vm = fixture('default').chat.replyMenus[0];
  assert.deepEqual(checkShape(vm, CHAT_SHAPE.replyMenu), []);
  const seen = [];
  const sheet = replySheet(vm, { onReread: () => seen.push('reread'), onOpenSuite: t => seen.push(t), onClose: () => seen.push('close') });
  assert.match(sheet.querySelector('b').textContent, /^This reply · /);
  assert.equal(sheet.querySelectorAll('li').length, 0, 'no change list');
  assert.doesNotMatch(sheet.textContent, /State then/u);
  assert.match(sheet.textContent, /Changes tab/u);
  const buttons = sheet.querySelectorAll('button');
  assert.deepEqual(buttons.map(b => b.textContent), ['Re-read this reply', 'Open Suite', 'Close']);
  buttons.forEach(b => b.click());
  assert.deepEqual(seen, ['reread', 'now', 'close']);
  assert.equal(replySheet({}, {}).querySelectorAll('button').length, 0);
  assert.equal(replySheet(undefined).querySelectorAll('button').length, 0);
});

test('Discard repair shows only with the handler and a repaired reply, fires once; the title stays text', () => {
  installFakeDom();
  const vm = fixture('default').chat.replyMenus[1];
  const seen = [];
  const sheet = replySheet(vm, { onDiscard: () => seen.push('discard') });
  const buttons = sheet.querySelectorAll('button');
  assert.deepEqual(buttons.map(b => b.textContent), ['Discard repair']);
  assert.equal(buttons[0].className, 'ssbtn', 'the mock\'s sheet button');
  buttons[0].click();
  assert.deepEqual(seen, ['discard']);
  assert.equal(replySheet({ ...vm, repaired: false }, { onDiscard: () => {} }).querySelectorAll('button').length, 0, 'no repair stored: no button');
  assert.equal(replySheet(vm, {}).querySelectorAll('button').length, 0, 'no handler: no button');
  assert.equal(replySheet({ at: '<i>x</i>' }).querySelectorAll('i').length, 0);
});
