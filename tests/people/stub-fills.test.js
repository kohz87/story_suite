// N7 (NSD6): the fill-in of a `+ npc` stub is started after the reply's hydrate: one fill per stub of that reply that has no background, once a session.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newStubs, queueNewStubFills } from '../../modules/people/adapter/stub-fills.js';
import { createPeopleSync } from '../../modules/people/adapter/people-sync.js';
import { hashJson } from '../../modules/people/adapter/hash.js';

const npcs = [
    { id: 'wiz', name: 'Wiz', createdAt: 5 },                                  // a stub of the reply at index 4
    { id: 'old', name: 'Old', createdAt: 3 },                                  // a stub of an earlier reply
    { id: 'full', name: 'Full', createdAt: 5, background: 'A clerk.' },        // already filled
    { id: 'scan', name: 'Scan', createdAt: 1794869494082 },                    // made by a scan (clock stamp)
    { id: 'gone', name: 'Gone', createdAt: 5, archived: true },
];

test('only the stubs of this reply with no background are fills', () => {
    assert.deepEqual(newStubs(npcs, 4), [{ id: 'wiz', name: 'Wiz' }]);
    assert.deepEqual(newStubs(null, 4), []);
});

function fake() {
    const calls = { queued: [], started: [] };
    return { calls, runtime: { getState: () => ({ npcs }), queueFills: (stubs, at) => { calls.queued.push({ stubs, at }); return true; }, processBackfills: (...args) => { calls.started.push(args); return Promise.resolve(0); } } };
}

test('a stub is queued once per chat, reply and swipe, and the queue is started', () => {
    const { calls, runtime } = fake();
    const at = { index: 4, sid: 's4', swipeKey: 0 };
    assert.equal(queueNewStubFills(runtime, 'chat-a', at), 1);
    assert.deepEqual(calls.queued, [{ stubs: [{ id: 'wiz', name: 'Wiz' }], at: 4 }], 'keyed by the reply that made the stub');
    assert.equal(calls.started.length, 1);
    assert.equal(queueNewStubFills(runtime, 'chat-a', at), 0, 'the same reply looked at again asks for nothing');
    assert.equal(queueNewStubFills(runtime, 'chat-a', { ...at, swipeKey: 1 }), 1, 'a swipe is another reading');
    assert.equal(queueNewStubFills(runtime, 'chat-b', at), 1, 'another chat is another chat');
});

test('the people sync calls afterHydrate with the head reply once the cache stands on it', async () => {
    const view = state => ({ v: 1, order: state.npcs.map(n => n.id), npcs: Object.fromEntries(state.npcs.map(n => [n.id, { ...n }])) });
    const slice = view({ npcs: [{ id: 'wiz', name: 'Wiz', createdAt: 2 }] });
    const sdk = {
        query: name => (name === 'people.hash' ? hashJson(slice) : undefined),
        view: () => ({ state: { domains: { people: slice } } }),
        timeline: { head: async () => ({ ok: true, source: { sid: 'b', swipeKey: 0 } }), history: async () => ({ ok: true, messages: [{ sid: 'a', swipeKey: 0 }, { sid: 'b', swipeKey: 0 }] }) },
        command: async () => ({ ok: true }),
    };
    const seen = [];
    const sync = createPeopleSync({ sdk: () => sdk, view, restore: s => ({ npcs: s.order.map(id => ({ ...s.npcs[id] })) }), hash: hashJson, install: () => true, afterHydrate: at => seen.push(at) });
    await sync.hydrate();
    assert.deepEqual(seen, [{ index: 1, sid: 'b', swipeKey: 0 }]);
});
