// Pins that the ✦ "this reply" button sits on the head reply's own action bar (not the reader's message after it), and moves on a swipe, a delete and an edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/dom.js';
import { turnOn } from '../../ui/entry/turn-on.js';

function page() {
  const doc = installFakeDom();
  doc.head = doc.createElement('head');
  doc.getElementById = id => doc.querySelector(`#${id}`);
  for (const id of ['extensions_settings2', 'extensionsMenu', 'chat', 'send_textarea', 'send_form']) {
    const el = doc.createElement('div');
    el.id = id;
    doc.body.appendChild(el);
  }
  return doc;
}

const addMessage = (doc, id) => {
  const mes = doc.createElement('div');
  mes.className = 'mes';
  mes.setAttribute('mesid', String(id));
  const bar = doc.createElement('div');
  bar.className = 'extraMesButtons';
  mes.appendChild(bar);
  doc.querySelector('#chat').appendChild(mes);
};
const barOf = (doc, id) => doc.querySelector(`#chat .mes[mesid="${id}"] .extraMesButtons`);

function host(chat) {
  const st = {};
  const sdk = {
    query: name => (name === 'reply.changes' ? { lines: [{ glyph: 'item', line: '+1 Rope', detail: null, applied: true }], refused: [], stateThen: {} } : name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : null),
    command: async () => ({ ok: true }), preview: async () => ({ ok: true }), commit: async () => ({ ok: true }), reread: async () => ({ ok: true }),
    on: () => () => {}, settings: Object.assign(() => ({}), { defaults: {}, schema: {} }), features: () => [],
  };
  const ctx = {
    chat, name1: 'Reader', chatMetadata: {}, extensionSettings: {},
    eventTypes: { CHAT_CHANGED: 'chat_changed', MESSAGE_RECEIVED: 'message_received', MESSAGE_SENT: 'message_sent', MESSAGE_SWIPED: 'message_swiped', MESSAGE_DELETED: 'message_deleted', MESSAGE_EDITED: 'message_edited' },
    eventSource: { on: (type, fn) => { (st[type] ??= new Set()).add(fn); }, removeListener: (type, fn) => st[type]?.delete(fn) },
  };
  return { StoryBlock: { sdk, writes: null, tools: null }, ctx, emitSt: type => { for (const fn of [...(st[type] ?? [])]) fn(0); } };
}

test('the ✦ button is on the head reply\'s bar when the reader\'s message is last, and follows a swipe or a delete', t => {
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  t.after(() => { delete globalThis.requestAnimationFrame; });
  const run = () => { while (frames.length) frames.shift()(); };
  const doc = page();
  const chat = [{ is_user: true, mes: 'Hi' }, { is_user: false, mes: 'Reply' }, { is_user: true, mes: 'More' }];
  chat.forEach((_, id) => addMessage(doc, id));
  const h = host(chat);
  const off = turnOn({ doc, base: 'x/', ctx: () => h.ctx, StoryBlock: h.StoryBlock });
  run();
  assert.equal(barOf(doc, 1).querySelectorAll('.xbt.ss').length, 1, 'on the reply, not on the reader\'s last message');
  assert.equal(barOf(doc, 2).querySelectorAll('.xbt.ss').length, 0);
  // A new reply arrives after a swipe elsewhere: the head moves, and a swipe event alone moves the button.
  chat.push({ is_user: false, mes: 'Next' });
  addMessage(doc, 3);
  h.emitSt('message_swiped');
  run();
  assert.equal(barOf(doc, 3).querySelectorAll('.xbt.ss').length, 1, 'a swipe event moves it to the head reply');
  assert.equal(barOf(doc, 1).querySelectorAll('.xbt.ss').length, 0);
  chat.pop();
  doc.querySelector('#chat .mes[mesid="3"]').remove();
  h.emitSt('message_deleted');
  run();
  assert.equal(doc.querySelectorAll('.xbt.ss').length, 1, 'a delete leaves exactly one button');
  off();
});
