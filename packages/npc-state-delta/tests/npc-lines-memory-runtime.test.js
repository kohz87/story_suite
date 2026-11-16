import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { normalizeNpcRecord } from '../core.js';
import { peopleView, peopleState } from '../src/people/view.js';
import { keepStampContainers } from '../src/people/keep-containers.js';
import { createPeopleSync } from '../src/adapter/people-sync.js';
import { hashJson } from '../src/storysuite-participant/hash.js';

// N5 (REVN5X fixes): the runtime rewrites every record through its normalizer and writes them back (people.write for the head reply). The per-reply cap marker `s` and a stub's
// empty `memoryStamps` container must survive that write, or Continue breaks the two-a-reply cap and a middle delete drops a later memory.
const people = s => s.host.head().domains.people;
const memories = (s, id = 'npc_oren') => people(s).npcs[id]?.memories ?? [];
const snap = s => JSON.stringify(people(s));
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const stateOf = slice => ({ npcs: slice.order.map(id => normalizeNpcRecord(structuredClone(slice.npcs[id]))), candidates: slice.candidates ?? [], dismissed: slice.dismissed ?? [], userDismissedGroups: slice.userDismissedGroups ?? [], socialGraph: slice.socialGraph ?? {}, portraitAssets: slice.portraitAssets ?? {}, turn: slice.turn ?? 0 });

// What the runtime sends: every record through the normalizer, the view, one people.write for the head's reply.
async function runtimeWrite(s, keep = built => built) {
    const built = keep(peopleView(stateOf(people(s))), people(s));
    const head = await s.host.sdk.timeline.head({});
    const out = await s.host.sdk.command('people.write', { v: 1, source: { sid: head.source.sid, swipeKey: head.source.swipeKey }, view: built }, { background: true });
    assert.equal(out.ok, true);
}

test('the per-reply cap holds after the runtime rewrote the reply\'s records: a third ~ memory in a Continue is refused', async () => {
    const s = await suite({ lines: true });
    await quiet(() => s.say(['~ memory Oren | Promised to guard the gate.', '~ memory Oren | Shared a joke about the abbot.']));
    await runtimeWrite(s);
    assert.ok(Object.values(people(s).npcs.npc_oren.memoryStamps).every(stamp => typeof stamp.s === 'string' && stamp.s), 'the cap marker survived the write');
    await quiet(async () => { await s.host.cont('\n\n<Changes>\n~ memory Oren | Swore never to speak of it.\n</Changes>'); await s.adapter.ticked(); });
    assert.deepEqual(memories(s), ['Promised to guard the gate.', 'Shared a joke about the abbot.'], 'the third is refused');
    same(s, 'replay equals live');
});

test('through the people sync with the lines-mode keep: the stub\'s empty container survives, so a middle delete leaves the later memory', async () => {
    const s = await suite({ lines: true });
    const sdk = s.host.sdk;
    const state = { current: null };
    const sync = createPeopleSync({
        sdk: () => sdk, view: peopleView, restore: peopleState, hash: hashJson, readState: () => state.current,
        install: keys => { state.current = { ...keys, npcs: keys.npcs.map(record => normalizeNpcRecord(structuredClone(record))) }; return true; },
        keep: keepStampContainers,
    });
    const first = await s.say(['~ npc Oren | trust: +1']);
    await sync.hydrate();
    assert.equal('memoryStamps' in state.current.npcs.find(record => record.id === 'npc_oren'), false, 'the runtime\'s normalizer dropped the empty container');
    state.current.turn += 1;   // a change of the runtime's own (a scan, a fill-in)
    assert.equal((await sync.commit(state.current)).sent, true);
    assert.deepEqual(people(s).npcs.npc_oren.memoryStamps, {}, 'the stored container is kept');
    const a = await s.say(['~ memory Oren | Promised to guard the gate.']);
    await s.say(['~ memory Oren | Shared a joke about the abbot.']);
    same(s, 'replay equals live');
    await quiet(async () => { await s.host.st.deleteMessage(a); await s.host.st.deleteMessage(a - 1); });
    assert.deepEqual(memories(s), ['Shared a joke about the abbot.']);
    assert.equal(s.host.store.problems?.().length ?? 0, 0, 'no store problem');
    same(s, 'middle delete replay equals live');
    assert.ok(first >= 0);
});

test('with the switch off (no keep step) the people sync writes the runtime\'s view as it is: the empty container is not put back', async () => {
    const s = await suite({ lines: false });
    const state = { current: null };
    const sync = createPeopleSync({
        sdk: () => s.host.sdk, view: peopleView, restore: peopleState, hash: hashJson, readState: () => state.current,
        install: keys => { state.current = { ...keys, npcs: keys.npcs.map(record => normalizeNpcRecord(structuredClone(record))) }; return true; },
    });
    await s.say(['~ npc Oren | trust: +1']);
    await sync.hydrate();
    state.current.turn += 1;
    assert.equal((await sync.commit(state.current)).sent, true);
    assert.equal('memoryStamps' in people(s).npcs.npc_oren, false, 'identical to the normalizer\'s output (main)');
});

test('keepStampContainers: only a stored empty-or-set container missing from the view is restored; a view with one is untouched', () => {
    const view = { npcs: { a: { id: 'a' }, b: { id: 'b', memoryStamps: { x: { m: 1 } } }, c: { id: 'c' } } };
    keepStampContainers(view, { npcs: { a: { memoryStamps: {} }, b: { memoryStamps: {} } } });
    assert.deepEqual(view.npcs, { a: { id: 'a', memoryStamps: {} }, b: { id: 'b', memoryStamps: { x: { m: 1 } } }, c: { id: 'c' } });
});

test('normalizeNpcRecord: a stamp keeps m and d, and s only when it has one; an empty container is dropped as before', () => {
    const rec = stamps => normalizeNpcRecord({ id: 'npc_x', name: 'X', memories: ['Aaa bbb ccc ddd.', 'Eee fff ggg hhh.'], memoryStamps: stamps }).memoryStamps;
    const key = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const out = rec({ [key('Aaa bbb ccc ddd.')]: { m: 2 }, [key('Eee fff ggg hhh.')]: { m: 3, d: 'May 1', s: 'sid1' } });
    assert.deepEqual(Object.values(out), [{ m: 2 }, { m: 3, d: 'May 1', s: 'sid1' }]);
    assert.equal(rec({}), undefined);
    assert.equal(rec({ nothing: { m: 1 } }), undefined, 'a container whose stamps all drop out goes');
});
