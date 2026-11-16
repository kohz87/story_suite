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
        state.checkpoints = [{ id: 'keep-me' }];
        await api.installState(state);
        let news = 0;
        api.onNativeChange(() => { news += 1; });
        out.ready = api.stateReady();
        const fresh = mechanics.createNpcRecord('Fenna', []);
        out.took = api.hydratePeople({ npcs: [fresh], candidates: [], socialGraph: { edges: [] }, turn: 3 });
        const after = api.getState();
        out.names = after.npcs.map(npc => npc.name);
        out.keptCheckpoints = after.checkpoints.length;
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
    assert.deepEqual(out.names, ['Fenna']);
    assert.equal(out.keptCheckpoints, 1, 'keys that are not people stay');
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

test('runtime: hosted, the journal reconcile is the store\'s (no rollback) and no parent dossiers are inherited; standalone is unchanged', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1), 'Delta registers with the v2 host');
        await sleep(200);
        const done = await api.reconcile({ rescan: false });
        console.log(`RESULT ${JSON.stringify({ action: done?.recoveryAction ?? null, relation: done?.lineageRelation ?? null, inherited: await api.inheritBranch() })}`);
    };
    const hosted = scenarioOutput(runHostScenario('people-bypass-hosted', v2HostPrelude, scenario));
    assert.equal(hosted.action, 'store-owned');
    assert.equal(hosted.relation, 'store-timeline');
    assert.equal(hosted.inherited, false);
    const alone = scenarioOutput(runHostScenario('people-bypass-alone', async () => {}, async () => {
        const api = globalThis.NPCStateDelta;
        await sleep(300);
        const done = await api.reconcile({ rescan: false });
        console.log(`RESULT ${JSON.stringify({ action: done?.recoveryAction ?? null, relation: done?.lineageRelation ?? null })}`);
    }));
    assert.notEqual(alone.action, 'store-owned', 'without a host the old reconcile runs');
});
