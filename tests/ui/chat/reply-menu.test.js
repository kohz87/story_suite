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

test('sheet lists the fixture lines, counts and state then', () => {
  installFakeDom();
  const vm = fixture('default').chat.replyMenus[0];
  assert.deepEqual(checkShape(vm, CHAT_SHAPE.replyMenu), []);
  const sheet = replySheet(vm);
  assert.match(sheet.querySelector('b').textContent, /^This reply · /);
  assert.equal(sheet.querySelectorAll('li').length, vm.lines.length);
  assert.match(sheet.textContent, /State then: /);
  assert.match(sheet.textContent, /\d+ changes?/);
});

test('a line that was not applied stands out and counts show', () => {
  installFakeDom();
  const vm = fixture({ notApplied: true }).chat.replyMenus[2];
  const sheet = replySheet(vm);
  assert.ok(sheet.querySelectorAll('li.na').length >= 1);
  assert.match(sheet.textContent, /1 not applied/);
});

test('buttons appear only with their handlers and fire them', () => {
  installFakeDom();
  const seen = [];
  const sheet = replySheet({ at: 'x', lines: [], counts: { changes: 1, heldBack: 0, notApplied: 0 } }, {
    onReread: () => seen.push('reread'), onOpenSuite: t => seen.push(t), onClose: () => seen.push('close'),
  });
  sheet.querySelectorAll('button').forEach(b => b.click());
  assert.deepEqual(seen, ['reread', 'now', 'close']);
  assert.equal(replySheet({}, {}).querySelectorAll('button').length, 0);
});

test('empty lines fall back to the counts line; markup stays text', () => {
  installFakeDom();
  const sheet = replySheet({ at: '', lines: [], counts: { changes: 10, heldBack: 1, notApplied: 0 }, stateThen: { place: '<i>P</i>', weather: null } });
  assert.match(sheet.textContent, /10 changes, 1 held back/);
  assert.equal(sheet.querySelectorAll('i').length, 0);
  assert.match(sheet.textContent, /State then: <i>P<\/i>/);
  assert.equal(replySheet(undefined).querySelectorAll('li').length, 1);
});
