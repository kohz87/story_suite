// N7: the hosted catch-up Refresh is journaled by the reply that counted it and a replay repeats it (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };   // the host stubs read it when the catch-up part's imports load
globalThis.__npcMock.context = { chat: [{ name: 'Narrator', mes: 'A is here.', is_user: false }] };
const { createCatchUpPart } = await import('../../modules/people/calls/runtime-catchup.js');

function part(state, calls = { refresh: [], backfills: [] }, { refreshed = true } = {}) {
    const rt = { captureCatchUp: new Map() };
    const deps = {
        readSettings: () => ({ narrationCaptureCatchUp: 1, narrationCaptureCatchUpPeople: 1 }), getChatKey: () => 'chat', getChatState: () => state, isHostSwipeActive: () => false, isScanBusy: () => false, persist: () => {},
        processPendingBackfills: async (id, options) => { calls.backfills.push({ id, skip: options.skipNpcIds }); },
        refreshNpcFromChat: async (id, options) => { calls.refresh.push({ id, at: options.at ?? null }); return refreshed; },
    };
    return { ...createCatchUpPart(rt, deps), calls };
}
const people = (...ids) => ({ npcs: ids.map(id => ({ id, archived: false })), pendingBackfills: [] });

test('the Refresh is bound to the reply that counted it, not to whatever reply is newest when it runs', async () => {
    const { noteCaptureCatchUp, runCaptureCatchUp, calls } = part(people('a'));
    const due = noteCaptureCatchUp('chat', ['a'], 0);
    assert.deepEqual(due, ['a']);
    await runCaptureCatchUp('chat', due, 0, 7);
    assert.deepEqual(calls.refresh, [{ id: 'a', at: 7 }]);
});

test('a replay repeats the Refreshes the journal kept and skips the people the catch-up took, as live', async () => {
    const state = people('a', 'b');
    state.pendingBackfills = [{ npcId: 'a', reason: 'repair' }, { npcId: 'b', reason: 'new-admission', attempts: 0 }];
    const { replayCatchUp, calls } = part(state);
    const entry = { catchUp: ['a', 'b'], refreshes: { a: { x: 1 }, b: { y: 2 } } };
    const skip = await replayCatchUp(entry, 5, false);
    assert.deepEqual(calls.refresh.map(item => item.id), ['a', 'b']);
    assert.ok(calls.refresh.every(item => item.at === 5));
    assert.deepEqual(skip, ['a'], 'a newly met person keeps its backfill, an established one is skipped');
    assert.deepEqual(state.pendingBackfills.map(item => item.npcId), ['b'], 'a Refresh that worked drops the established person\'s queued repair');
});

test('a Refresh live did not finish is not made up by the replay, and one a scan replays is not done twice', async () => {
    const one = part(people('a'));
    assert.deepEqual(await one.replayCatchUp({ catchUp: ['a'], refreshes: {} }, 3, false), ['a']);
    assert.deepEqual(one.calls.refresh, []);
    const two = part(people('a'));
    assert.deepEqual(await two.replayCatchUp({ catchUp: ['a'], refreshes: { a: {} } }, 3, true), ['a']);
    assert.deepEqual(two.calls.refresh, []);
});

test('the Refresh the catch-up asks for is kept under the reply that counted it (pin: refreshNpcFromChat takes `at`)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../modules/people/calls/runtime-targeted-refresh.js', import.meta.url), 'utf8');
    assert.match(source, /captureMessageId: Number\.isInteger\(at\) \? at : latestMessageId\(true\), captureKind: 'refreshes'/);
});
