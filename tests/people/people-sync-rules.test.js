// The people sync's rules beyond the basics (P3 fix): a replaced reply tells the runtime to read it again, a change made before the first hydrate is carried over it,
// a change after the head moved belongs to the new reply, another chat's cache is never kept, and no unresolved owner is ever a name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleSync } from '../src/adapter/people-sync.js';
import { peopleView, peopleState, peopleCarry } from '../src/people/view.js';
import { hashJson } from '../src/storysuite-participant/hash.js';

const mk = id => ({ id: `npc_${id}`, name: id.toUpperCase(), aliases: [], lifeState: 'alive' });
function rig({ ready = true } = {}) {
    const f = { source: { sid: 'a', swipeKey: 1, ordinal: 0 }, slice: peopleView({ npcs: [mk('mira')] }), state: { npcs: [mk('mira')] }, key: 'chat1', ready, rescans: 0, sent: [], warned: [] };
    const sdk = {
        query: name => (name === 'people.hash' ? hashJson(f.slice) : undefined),
        view: () => ({ state: { domains: { people: f.slice } } }),
        // the host's history: the reply's place is its index here (a source's `ordinal` is the block's place inside its reply: always 0 in Story Block)
        timeline: { head: async () => ({ ok: true, source: f.source }), history: async () => ({ ok: true, messages: (f.places ?? ['a', 'b', 'c']).map(sid => ({ sid })) }) },
        command: async (_t, payload) => { f.sent.push(payload); f.slice = payload.view; return { ok: true }; },
    };
    const sync = createPeopleSync({
        sdk: () => sdk, view: peopleView, restore: peopleState, hash: hashJson, warn: text => f.warned.push(text), readState: () => f.state,
        install: keys => { f.state = { ...f.state, ...keys }; return true; }, ready: () => f.ready, chatKey: () => f.key, rescan: () => { f.rescans += 1; }, carry: peopleCarry,
    });
    return { f, sync };
}

test('a delete or swipe then a new reply at the same place tells the runtime to read it again, even when the people did not change; a newer reply does not', async () => {
    const { f, sync } = rig();
    await sync.hydrate();
    f.source = { sid: 'b', swipeKey: 1, ordinal: 0 };
    await sync.sync();
    assert.equal(f.rescans, 0, 'a newer reply keeps the marker');
    f.places = ['a', 'c'];
    f.source = { sid: 'c', swipeKey: 1, ordinal: 0 };   // reply b was deleted, a new reply took its place
    await sync.sync();
    assert.equal(f.rescans, 1);
    f.source = { sid: 'c', swipeKey: 2, ordinal: 0 };   // a swipe of that reply
    await sync.sync();
    assert.equal(f.rescans, 2);
});

test('a change made before the first hydrate is carried over the store\'s people and stored after it (a late first hydrate)', async () => {
    const { f, sync } = rig({ ready: false });
    f.state = { npcs: [mk('tom')] };   // a fresh cache with a dossier made before the story was ready
    const early = await sync.commit();
    assert.equal(early.owed, true);
    assert.match(f.warned.join(' '), /kept/);
    assert.equal((await sync.hydrate()).hydrated, false, 'not ready yet: refused');
    f.ready = true;
    assert.equal((await sync.hydrate()).hydrated, true);
    assert.deepEqual(f.state.npcs.map(n => n.id).sort(), ['npc_mira', 'npc_tom']);
    assert.deepEqual(Object.keys(f.slice.npcs).sort(), ['npc_mira', 'npc_tom'], 'the store holds both');
    assert.equal(f.sent.length, 1);
});

test('a change that finds the head on a newer reply (store people unchanged) is stored for that reply', async () => {
    const { f, sync } = rig();
    await sync.hydrate();
    f.source = { sid: 'b', swipeKey: 1, ordinal: 1 };   // the host's head moved; no turn event yet
    f.state = { npcs: [mk('mira'), mk('tom')] };
    assert.equal((await sync.commit()).sent, true);
    assert.deepEqual(f.sent[0].source, { sid: 'b', swipeKey: 1 });
});

test('a chat switch without unhost never keeps the other chat\'s cache', async () => {
    const { f, sync } = rig();
    await sync.hydrate();
    f.key = 'chat2';
    f.state = { npcs: [mk('zed')] };
    assert.equal((await sync.commit()).owed, true, 'the cache of chat1 is not chat2\'s');
    assert.equal(sync.source(), null);
});

test('unresolved owners are npc ids or empty: a name is resolved, an unknown one is emptied', () => {
    const graph = { edges: [], unresolved: [{ ownerId: 'Mira' }, { ownerId: 'npc_tom' }, { ownerId: 'Nobody' }, { ownerId: '' }, { ownerId: 'mira' }] };
    const out = peopleView({ npcs: [mk('mira'), mk('tom')], socialGraph: graph });
    assert.deepEqual(out.socialGraph.unresolved.map(s => s.ownerId), ['npc_mira', 'npc_tom', '', '', 'npc_mira']);
});

test('a store change while the hydrate waits for the history is seen by the next sync (the hash is read with the slice)', async () => {
    const { f, sync } = rig();
    const tom = peopleView({ npcs: [mk('mira'), mk('tom')] });
    const first = f.slice;
    f.places = ['a', 'b', 'c'];
    let moved = false;
    Object.defineProperty(f, 'places', { get() { if (!moved) { moved = true; f.slice = tom; } return ['a', 'b', 'c']; }, set() {}, configurable: true });
    await sync.hydrate();
    assert.equal(f.state.npcs.length, 1, 'the cache holds the slice it read');
    f.source = { sid: 'a', swipeKey: 1, ordinal: 0 };
    const out = await sync.sync();
    assert.equal(out.hydrated, true, 'the store moved after the read: the sync hydrates again');
    assert.notEqual(f.slice, first);
});
