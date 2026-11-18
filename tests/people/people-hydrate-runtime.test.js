import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';

// The real runtime's two people hooks on the synthetic host (P3 fix): hydratePeople replaces the people only, keeps every other key, drops the scan bookkeeping of the replaced
// head, clamps the marker, announces no native change and refuses a bad call; rescanLatest holds the marker below the latest reply so that reply is read again.
const scenarioOutput = output => JSON.parse(String(output).split('\n').find(line => line.startsWith('RESULT ')).slice(7));

test('runtime: hydratePeople and rescanLatest on the real runtime', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        await sleep(300);
        const out = {};
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Hello.' }, { is_user: false, is_system: false, name: 'Megumin', mes: 'Hi there.', swipe_id: 0 });
        const mechanics = await import(pathToFileURL(path.join(extRoot, 'core-mechanics.js')).href);
        const state = api.getState();
        state.npcs = [mechanics.createNpcRecord('Old', [])];
        state.pendingBackfills = [{ id: 'x' }];
        state.readAhead = [1];
        state.lastScannedMessageId = 40;
        state.keepMe = { id: 'keep-me' };
        Object.assign(state, { checkpoints: [{ messageId: 1 }], rollbackJournal: [{ seq: 1 }], inlineCards: [{ messageId: 1, cards: [] }], branchRootSnapshot: { npcs: [] } });
        await api.installState(state);
        out.retired = ['checkpoints', 'rollbackJournal', 'inlineCards', 'branchRootSnapshot'].filter(key => key in api.getState());
        let news = 0;
        api.onNativeChange(() => { news += 1; });
        out.ready = api.stateReady();
        const fresh = mechanics.createNpcRecord('Fenna', []);
        out.took = api.hydratePeople({ npcs: [fresh], candidates: [], socialGraph: { edges: [] }, turn: 3 });
        const after = api.getState();
        out.names = after.npcs.map(npc => npc.name);
        out.kept = after.keepMe?.id ?? null;
        out.backfills = after.pendingBackfills.length;
        out.readAhead = after.readAhead.length;
        out.marker = after.lastScannedMessageId;
        out.news = news;
        out.refusedNull = api.hydratePeople(null);
        out.refusedArray = api.hydratePeople('x');
        // rescanLatest: the marker says the latest reply (index 1) was read; it is held below it.
        const s2 = api.getState();
        s2.lastScannedMessageId = 1;
        await api.installState(s2);
        out.rescan = api.rescanLatest();
        out.markerAfterRescan = api.getState().lastScannedMessageId;
        out.rescanAgain = api.rescanLatest();
        console.log(`RESULT ${JSON.stringify(out)}`);
    };
    const out = scenarioOutput(runHostScenario('people-hydrate', () => {}, scenario));
    assert.equal(out.took, true);
    assert.deepEqual(out.retired, [], 'a state saved with the removed branch journal loads with it dropped (B4-10a)');
    assert.deepEqual(out.names, ['Fenna']);
    assert.equal(out.kept, 'keep-me', 'keys that are not people stay');
    assert.equal(out.backfills, 0);
    assert.equal(out.readAhead, 0);
    assert.ok(out.marker <= 1, 'the marker is held to the chat');
    assert.equal(out.news, 0, 'a hydrate is not news for the store');
    assert.equal(out.refusedNull, false);
    assert.equal(out.refusedArray, false);
    assert.equal(out.rescan, true);
    assert.equal(out.markerAfterRescan, 0);
    assert.equal(out.rescanAgain, false, 'nothing more to hold');
});

const v2HostPrelude = async () => {
    const sdk = { registered: [], registerModule(def) { sdk.registered.push(def); } };
    mockState.sdk = sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
};

// B4-10a: the branch journal is gone. Hosted or alone, the public reconcile is the settle pass: it rolls nothing back, reports no recovery, and no
// parent chat's dossiers are inherited (the hook is gone).
test('runtime: reconcile is the settle pass, hosted or alone: no rollback and no inherited dossiers', () => {
    const settle = async () => {
        const api = globalThis.NPCStateDelta;
        if (mockState.sdk) assert.ok(await waitFor(() => mockState.sdk.registered.length === 1), 'Delta registers with the v2 host');
        await sleep(mockState.sdk ? 200 : 300);
        const before = JSON.stringify(api.getState().npcs);
        const done = await api.reconcile({ operation: 'delete' });
        console.log(`RESULT ${JSON.stringify({ keys: Object.keys(done || {}).sort(), same: JSON.stringify(done?.state?.npcs) === before, inherit: typeof api.inheritBranch })}`);
    };
    const hosted = scenarioOutput(runHostScenario('people-settle-hosted', v2HostPrelude, settle));
    const alone = scenarioOutput(runHostScenario('people-settle-alone', async () => {}, settle));
    for (const out of [hosted, alone]) {
        assert.deepEqual(out.keys, ['operation', 'state'], 'no recovery fields: nothing was rolled back');
        assert.equal(out.same, true);
        assert.equal(out.inherit, 'undefined');
    }
});

// The two P4 hooks on the real runtime: setScanMarker takes the store's marker (and the replies since the scan) in place, dropping only the pending backfills and
// read-ahead; setPeopleRecord sets one person's record in place (a host-confirmed death) and keeps everything else, the scan bookkeeping included. Neither announces
// a native change (the store already holds what they set) and both refuse a bad call.
test('runtime: setScanMarker and setPeopleRecord on the real runtime', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        await sleep(300);
        const out = {};
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Hello.' }, { is_user: false, is_system: false, name: 'Megumin', mes: 'Hi there.', swipe_id: 0 });
        const mechanics = await import(pathToFileURL(path.join(extRoot, 'core-mechanics.js')).href);
        const state = api.getState();
        state.npcs = [mechanics.createNpcRecord('Fenna', []), mechanics.createNpcRecord('Oren', [])];
        state.pendingBackfills = [{ id: 'x' }];
        state.readAhead = [1];
        state.lastScannedMessageId = 0;
        state.assistantSinceScan = 0;
        state.keepMe = { id: 'keep-me' };
        await api.installState(state);
        out.before = [api.getState().pendingBackfills?.length ?? null, api.getState().readAhead?.length ?? null];
        let news = 0;
        api.onNativeChange(() => { news += 1; });
        // A death record for Oren, set in place: Fenna, the bookkeeping and the other keys stay.
        const oren = { ...api.getState().npcs[1], lifeState: 'deceased' };
        out.setRecord = api.setPeopleRecord(oren);
        const afterRecord = api.getState();
        out.lives = afterRecord.npcs.map(npc => [npc.name, npc.lifeState]);
        out.recordBackfills = afterRecord.pendingBackfills.length;
        out.recordReadAhead = afterRecord.readAhead.length;
        out.recordKept = afterRecord.keepMe?.id ?? null;
        out.refusedUnknown = api.setPeopleRecord({ id: 'npc_nobody', name: 'Nobody' });
        out.refusedBad = api.setPeopleRecord(null);
        // The store's marker: the latest reply (index 1) was read, one reply since; then none read.
        out.mark = api.setScanMarker(1, 1);
        const afterMark = api.getState();
        out.marker = afterMark.lastScannedMessageId;
        out.since = afterMark.assistantSinceScan;
        out.markBackfills = afterMark.pendingBackfills.length;
        out.markReadAhead = afterMark.readAhead.length;
        out.markNames = afterMark.npcs.map(npc => npc.name);
        out.markNull = api.setScanMarker(null);
        out.markerNull = api.getState().lastScannedMessageId;
        out.refusedIndex = api.setScanMarker(-2);
        out.news = news;
        console.log(`RESULT ${JSON.stringify(out)}`);
    };
    const out = scenarioOutput(runHostScenario('people-hooks', () => {}, scenario));
    assert.equal(out.setRecord, true, JSON.stringify(out));
    assert.deepEqual(out.lives, [['Fenna', out.lives[0][1]], ['Oren', 'deceased']]);
    assert.equal(out.before[1], 1, 'the read-ahead is set before the hooks run');
    assert.equal(out.recordBackfills, out.before[0], 'a death keeps the pending backfills as they were');
    assert.equal(out.recordReadAhead, 1, 'and the read-ahead');
    assert.equal(out.recordKept, 'keep-me', 'and every other key');
    assert.equal(out.refusedUnknown, false);
    assert.equal(out.refusedBad, false);
    assert.equal(out.mark, true);
    assert.equal(out.marker, 1);
    assert.equal(out.since, 1);
    assert.equal(out.markBackfills, 0, 'a marker from the store drops the pending backfills');
    assert.equal(out.markReadAhead, 0);
    assert.deepEqual(out.markNames, ['Fenna', 'Oren'], 'the people stay');
    assert.equal(out.markNull, true);
    assert.equal(out.markerNull, null);
    assert.equal(out.refusedIndex, false);
    assert.equal(out.news, 0, 'neither is news for the store');
});
