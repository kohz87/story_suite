// Pins that the new view's chat surfaces (ui/entry/turn-on.js) are built once a frame for a burst of port and SillyTavern events, and not after turn-off.
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

// A Story Block sdk whose events the test sends; `chatBuilds()` counts `reply.changes` asks: the chat view asks it once per build, the flags never, and the card is not read while the suite is closed.
function fakeHost() {
  const listeners = {};
  let asked = 0;
  const sdk = {
    query: name => { if (name === 'reply.changes') asked += 1; return name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : null; },
    command: async () => ({ ok: true }), preview: async () => ({ ok: true }), commit: async () => ({ ok: true }), reread: async () => ({ ok: true }),
    on: (event, fn) => { (listeners[event] ??= new Set()).add(fn); return () => listeners[event].delete(fn); },
    settings: Object.assign(() => ({}), { defaults: {}, schema: {} }),
    features: () => [],
  };
  const st = {};
  const ctx = {
    chat: [], name1: 'Reader', chatMetadata: {}, extensionSettings: {},
    eventTypes: { CHAT_CHANGED: 'chat_changed', MESSAGE_RECEIVED: 'message_received', MESSAGE_SENT: 'message_sent' },
    eventSource: { on: (type, fn) => { (st[type] ??= new Set()).add(fn); }, removeListener: (type, fn) => st[type]?.delete(fn) },
  };
  const emit = event => { for (const fn of [...(listeners[event] ?? [])]) fn({}); };
  const emitSt = type => { for (const fn of [...(st[type] ?? [])]) fn(0); };
  return { StoryBlock: { sdk, writes: null, tools: null }, ctx, emit, emitSt, chatBuilds: () => asked };
}

test('a burst of port and SillyTavern events builds the chat view once, in the next frame; none after turn-off', t => {
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  t.after(() => { delete globalThis.requestAnimationFrame; });
  const run = () => { while (frames.length) frames.shift()(); };
  const doc = page();
  const host = fakeHost();
  const off = turnOn({ doc, base: 'x/', ctx: () => host.ctx, StoryBlock: host.StoryBlock });
  assert.equal(host.chatBuilds(), 1, 'drawn once at turn-on');
  run();
  const start = host.chatBuilds();
  for (const event of ['head', 'committed', 'turn', 'feature']) host.emit(event);
  for (const type of ['chat_changed', 'message_received', 'message_sent']) host.emitSt(type);
  assert.equal(host.chatBuilds(), start, 'nothing built before the frame');
  run();
  assert.equal(host.chatBuilds(), start + 1, 'seven events, one chat build');
  host.emit('head');
  host.emitSt('chat_changed');
  run();
  assert.equal(host.chatBuilds(), start + 2, 'the next burst builds once more');
  host.emit('committed');
  off();
  run();
  host.emit('head');
  host.emitSt('message_received');
  run();
  assert.equal(host.chatBuilds(), start + 2, 'turned off: a pending frame and later events build nothing');
});
