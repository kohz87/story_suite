import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchers } from '../../modules/people/adapter/cast-ui/watchers.js';
import { createStorySuiteV2Adapter } from '../../modules/people/storysuite-v2.js';

test('page-API change notifications: only the streamed-token cast render is coalesced and held; every other change goes out at once', async () => {
    let generating = false;
    const { watchers, notifyChange } = createWatchers({ warn: () => {}, delta: () => ({ generationActive: () => generating }) });
    let calls = 0;
    watchers.add(() => { calls += 1; });
    notifyChange(true);
    assert.equal(calls, 1, 'the first one runs at once');
    for (let i = 0; i < 50; i += 1) notifyChange(true);
    assert.equal(calls, 1, 'the burst waits');
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(calls, 2, 'the burst became one trailing call');
    generating = true;
    for (let i = 0; i < 50; i += 1) notifyChange(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(calls, 2, 'nothing runs while a reply is being made');
    notifyChange();   // a user-driven change (not the streamed-token render): out at once, also in a generation
    assert.equal(calls, 3, 'it did not wait for the generation');
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(calls, 3, 'it also took the waiting trailing call with it');
    generating = false;
    notifyChange(true);
    assert.equal(calls, 4, 'after the generation the first one runs at once');
    notifyChange(true);   // inside the quiet gap of that run: waits
    notifyChange();       // an immediate one takes the waiting call with it
    assert.equal(calls, 5);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(calls, 5, 'nothing stays scheduled');
});

test('page-API notifications: the first marked one during an active generation is held (not run at once), and a plain one still goes out at once', async () => {
    const { watchers, notifyChange } = createWatchers({ warn: () => {}, delta: () => ({ generationActive: () => true }) });
    let calls = 0;
    watchers.add(() => { calls += 1; });
    notifyChange(true);
    assert.equal(calls, 0, 'the first marked notification of an active generation is held');
    notifyChange();
    assert.equal(calls, 1, 'an unmarked one goes out at once and takes the waiting call');
    await new Promise(resolve => setTimeout(resolve, 900));
    assert.equal(calls, 1, 'nothing stays scheduled');
});

test('the real adapter wiring: Delta turned off during a generation tells the page API at once; the streamed-token cast render is held until the generation ends', async () => {
    const listeners = new Map();
    const doc = { documentElement: { dataset: {} }, getElementById: () => null, addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]), dispatchEvent: () => true };
    const fire = (name, detail) => { for (const fn of listeners.get(name) ?? []) fn({ type: name, detail }); };
    let enabled = true;
    let generating = false;
    const npc = { id: 'mira', name: 'Mira', present: true };
    const delta = { isEnabled: () => enabled, generationActive: () => generating, presentCastHtml: () => '', fillPresentCast: () => {}, dossierRevision: () => 'chat|1', getNpc: () => npc, dossiersReady: () => true };
    const sdk = { registerModule: async () => true, on: () => () => {}, query: () => [], settings: () => ({}), feature: () => false };
    const host = { apiVersion: 2, sdk, ready: Promise.resolve(sdk) };
    const timers = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} };
    const adapter = createStorySuiteV2Adapter({ suiteApi: { npcs: () => [npc] }, delta: () => delta, host: () => host, doc, timers, logger: { warn() {} }, loadEmptyCast: async () => null });
    adapter.start();
    await adapter.settled();
    assert.equal(adapter.hosted(), true);
    let calls = 0;
    const seen = [];
    const off = adapter.pageApi.onChange(() => { calls += 1; seen.push(adapter.pageApi.available()); });
    try {
        generating = true;
        fire('npc-state-delta:cast-rendered', { streaming: true });   // the first runs at once
        const first = calls;
        for (let i = 0; i < 20; i += 1) fire('npc-state-delta:cast-rendered', { streaming: true });   // one per streamed token
        assert.equal(calls, first, 'the streamed-token renders wait');
        fire('npc-state-delta:cast-rendered', { streaming: false });   // a manual dossier edit's render (not the streaming message's growth)
        assert.equal(calls, first + 1, 'a render not caused by the stream goes out at once, mid-generation');
        const base = calls;
        enabled = false;
        fire('npc-state-delta:enabled-changed');
        assert.equal(calls, base + 1, 'Delta turned off goes out at once, in the middle of the generation');
        assert.equal(seen.at(-1), false, 'and the page API already says it is off');
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.equal(calls, base + 1, 'nothing else is run for the held renders');
    } finally { off(); adapter.stop(); generating = false; }
});
