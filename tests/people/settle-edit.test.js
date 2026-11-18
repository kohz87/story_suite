// PB5 (perf): NPC State's edit/delete settle wait, loaded as SillyTavern runs it (the real adapter on a synthetic host).
// SillyTavern sends MESSAGE_EDITED / MESSAGE_DELETED after it has changed the chat, so the old 5 s poll never settled: it polled every
// 50 ms, built two branch-history diagnostics (uiStatus) per poll and timed out with a warning. Pinned here by counts: no uiStatus
// call, one look (one chat read after the baseline), no warning, and the probe reconcile still runs for each event.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { pageHandles } from '../../modules/people/runtime/handles.js';

const EVENTS = { MESSAGE_EDITED: 'message_edited', MESSAGE_DELETED: 'message_deleted', CHAT_CHANGED: 'chat_changed' };
const say = (is_user, mes) => ({ is_user, is_system: false, mes });
const host = { chat: [], chatReads: 0, swipe: 'none', key: 'chat:a', uiStatus: 0, reconciles: [], warns: [], listeners: new Map() };
const context = {
    get chat() { host.chatReads += 1; return host.chat; },
    eventTypes: EVENTS,
    eventSource: { on: (name, fn) => host.listeners.set(name, fn) },
    swipe: { state: () => host.swipe },
};
globalThis.__npcMock = { extensionSettings: {}, context };
pageHandles.deltaApi = {
    uiStatus: () => { host.uiStatus += 1; return { chatKey: host.key, swipeState: host.swipe }; },
    chatKey: () => host.key,
    reconcile: async options => { host.reconciles.push(options); return { invalidated: false }; },
};
mock.timers.enable({ apis: ['setTimeout', 'Date'] });
mock.method(console, 'warn', (...args) => { host.warns.push(args.join(' ')); });
await import('../../modules/people/core/destructive-settlement.js');
const controller = globalThis.__NPCStateDeltaDestructiveSettlement.controller;

const flush = () => new Promise(resolve => setImmediate(resolve));
function reset(chat) {
    host.chat = chat; host.chatReads = 0; host.swipe = 'none'; host.key = 'chat:a'; host.uiStatus = 0; host.reconciles = []; host.warns = [];
}
const story = () => [say(true, 'u0'), say(false, 'a1'), say(true, 'u2'), say(false, 'a3'), say(true, 'u4'), say(false, 'a5')];
async function emit(name, id) { host.listeners.get(name)(id); await flush(); }
async function tickAndWait(ms) { mock.timers.tick(ms); await flush(); }

test('an edit is looked at once, on the next tick, and the wait ends: no uiStatus, no timeout warning, the probe reconcile runs', async () => {
    reset(story());
    host.chat[3].mes = 'a3 revised';   // SillyTavern changes the text, then sends the event
    await emit(EVENTS.MESSAGE_EDITED, 3);
    assert.equal(controller.status().pending, true);
    await tickAndWait(0);
    assert.equal(controller.status().pending, false, 'the wait ends at the first tick');
    await tickAndWait(10000);
    assert.equal(host.chatReads, 2, 'the baseline read and one look; the old poll read the chat every 50 ms for 5 s');
    assert.equal(host.uiStatus, 0, 'the chat key and swipe state are read directly, not through uiStatus');
    assert.deepEqual(host.warns, []);
    assert.deepEqual(host.reconciles, [{ explicitDivergence: 3, operation: 'edit', rescan: true, reason: 'message-edited-probe', chatKey: 'chat:a' }]);
});

test('a middle delete is looked at once too, and its probe reconcile runs with the id SillyTavern sent', async () => {
    reset(story());
    host.chat.splice(2, 1);
    await emit(EVENTS.MESSAGE_DELETED, host.chat.length);
    await tickAndWait(0);
    assert.equal(controller.status().pending, false);
    await tickAndWait(10000);
    assert.equal(host.chatReads, 2);
    assert.equal(host.uiStatus, 0);
    assert.deepEqual(host.warns, []);
    assert.deepEqual(host.reconciles, [{ explicitDivergence: 5, operation: 'delete', rescan: true, reason: 'message-deleted-probe', chatKey: 'chat:a' }]);
});

test('a second edit before the tick still settles against the first one\'s baseline, unless SillyTavern is mid-swipe', async () => {
    reset(story());
    host.chat[1].mes = 'a1 revised';
    await emit(EVENTS.MESSAGE_EDITED, 1);
    host.chat[3].mes = 'a3 revised';
    await emit(EVENTS.MESSAGE_EDITED, 3);
    await tickAndWait(0);
    assert.equal(controller.status().pending, false);
    assert.deepEqual(host.reconciles.map(options => options.reason), ['message-edited-probe', 'message-edited-probe', 'message-edited-settled']);
    assert.equal(host.reconciles[2].explicitDivergence, 3);

    reset(story());
    host.swipe = 'swiping';   // read from SillyTavern's context, as runtime-chat-branch.js reads it
    host.chat[1].mes = 'a1 revised';
    await emit(EVENTS.MESSAGE_EDITED, 1);
    host.chat[3].mes = 'a3 revised';
    await emit(EVENTS.MESSAGE_EDITED, 3);
    await tickAndWait(0);
    await tickAndWait(10000);
    assert.equal(controller.status().pending, false);
    assert.deepEqual(host.reconciles.map(options => options.reason), ['message-edited-probe', 'message-edited-probe']);
    assert.equal(host.uiStatus, 0);
    assert.deepEqual(host.warns, []);
});

test('no open chat: nothing is scheduled; a chat change before the tick cancels the look', async () => {
    reset(story());
    host.key = 'no-chat';
    await emit(EVENTS.MESSAGE_EDITED, 1);
    assert.equal(controller.status().pending, false);
    assert.deepEqual(host.reconciles, []);

    reset(story());
    host.chat[1].mes = 'a1 revised';
    await emit(EVENTS.MESSAGE_EDITED, 1);
    host.key = 'chat:b';
    host.chat[3].mes = 'changed in the other chat';
    await tickAndWait(0);
    assert.equal(controller.status().pending, false);
    assert.deepEqual(host.reconciles.map(options => options.reason), ['message-edited-probe']);
    assert.equal(host.uiStatus, 0);
});
