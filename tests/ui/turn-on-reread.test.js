// Pins that the ✦ sheet's "Re-read this reply" button reaches the sdk for the head reply (an edited reply's way to read its text again).
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
  // (SillyTavern's shape: the button row sits in .mes_buttons, the text and the reply card in .mes_block)
  const block = doc.createElement('div');
  block.className = 'mes_block';
  mes.appendChild(block);
  const row = doc.createElement('div');
  row.className = 'mes_buttons';
  const bar = doc.createElement('div');
  bar.className = 'extraMesButtons';
  row.appendChild(bar);
  block.appendChild(row);
  doc.querySelector('#chat').appendChild(mes);
};
const barOf = (doc, id) => doc.querySelector(`#chat .mes[mesid="${id}"] .extraMesButtons`);

function host(chat, rereads = []) {
  const st = {};
  const sdk = {
    query: name => (name === 'reply.changes' ? { lines: [{ glyph: 'item', line: '+1 Rope', detail: null, applied: true }], refused: [], stateThen: {} } : name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : null),
    command: async () => ({ ok: true }), preview: async () => ({ ok: true }), commit: async () => ({ ok: true }), reread: async (...args) => { rereads.push(args); return { ok: true }; },
    on: () => () => {}, settings: Object.assign(() => ({}), { defaults: {}, schema: {} }), features: () => [],
  };
  const ctx = {
    chat, name1: 'Reader', chatMetadata: {}, extensionSettings: {},
    eventTypes: { CHAT_CHANGED: 'chat_changed', MESSAGE_RECEIVED: 'message_received', MESSAGE_SENT: 'message_sent', MESSAGE_SWIPED: 'message_swiped', MESSAGE_DELETED: 'message_deleted', MESSAGE_EDITED: 'message_edited' },
    eventSource: { on: (type, fn) => { (st[type] ??= new Set()).add(fn); }, removeListener: (type, fn) => st[type]?.delete(fn) },
  };
  return { StoryBlock: { sdk, writes: null, tools: null }, ctx, emitSt: type => { for (const fn of [...(st[type] ?? [])]) fn(0); } };
}

test('the ✦ sheet offers "Re-read this reply" and it re-reads the head reply, then closes the sheet', t => {
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  t.after(() => { delete globalThis.requestAnimationFrame; });
  const run = () => { while (frames.length) frames.shift()(); };
  const doc = page();
  const chat = [{ is_user: true, mes: 'Hi' }, { is_user: false, mes: 'Reply' }, { is_user: true, mes: 'More' }];
  chat.forEach((_, id) => addMessage(doc, id));
  const rereads = [];
  const h = host(chat, rereads);
  const off = turnOn({ doc, base: 'x/', ctx: () => h.ctx, StoryBlock: h.StoryBlock });
  run();
  barOf(doc, 1).querySelector('.xbt.ss').click();
  const reread = doc.querySelectorAll('.trsheet button').find(b => b.textContent === 'Re-read this reply');
  assert.ok(reread, 'the sheet has a Re-read button');
  assert.equal(doc.querySelector('.trsheet').parentNode.className, 'mes_block', 'the sheet sits in the message body, not in the button row (owner, 20 Nov: it was squeezed beside the icons)');
  reread.click();
  assert.deepEqual(rereads.map(call => call[0]), [1], 'the head reply (the last carrier) is read again');
  assert.equal(doc.querySelectorAll('.trsheet').length, 0, 'the sheet closes');
  off();
});
