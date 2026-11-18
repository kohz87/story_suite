import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeSource } from './helpers/runtime-source.js';
import {
    CAST_TAB_ID,
    HOST_RETRY_ATTEMPTS,
    MODULE_ID,
    QUERY_NAMES,
    V2_HOST_EVENT,
    createStorySuiteV2Adapter,
    isV2Host,
} from '../../modules/people/storysuite-v2.js';
import { fakeDocument, fakeSdk, fakeTimers, hosted, setup, v2Host } from './storysuite-v2.helpers.js';
import { pageHandles } from '../../modules/people/runtime/handles.js';

// ---- without a host ----

test('without Story Block the adapter looks once, sets no timer, and touches nothing', async () => {
    const { adapter, timers, dom } = setup({ hostValue: undefined });
    adapter.start();
    assert.equal(timers.timeouts.size, 0, 'no retry is scheduled');
    assert.ok(!timers.runTimeouts());
    assert.equal(timers.intervals.size, 0);
    assert.equal(adapter.hosted(), false);
    assert.equal(await adapter.settled(), false);
    assert.equal(dom.panel.style.display, 'block');
    assert.equal(dom.panel.parentNode, dom.drawer);
    assert.equal(dom.panel.dataset.npcStateDeltaHosted, undefined);
});

test('a v1 Story Block (registerTab, no ready or sdk) is not a v2 host and is left to the v1 tabs', async () => {
    const v1 = { apiVersion: 1, registerTab() {}, unregisterTab() {}, refresh() {} };
    assert.equal(isV2Host(v1), false);
    assert.equal(isV2Host(undefined), false);
    assert.equal(isV2Host({ ready: Promise.resolve({}) }), true);
    assert.equal(isV2Host({ sdk: { registerModule() {} } }), true);
    const { adapter, timers, dom } = setup({ hostValue: v1 });
    adapter.start();
    while (timers.runTimeouts());
    assert.equal(adapter.hosted(), false);
    assert.equal(dom.panel.style.display, 'block');
});

// ---- registration ----

test('registers module npc-state-delta once, with the npc domain, its queries and commands, a Cast tab and a settings section', async () => {
    const { adapter, sdk, def, timers } = await hosted();
    assert.equal(sdk.registered.length, 1);
    assert.equal(def.id, MODULE_ID);
    assert.equal(def.name, 'NPC State');
    assert.equal(def.version, '1.18.0');
    assert.equal(def.domains, undefined, 'no domain of its own: the NPC meters live in the people domain (people store P4)');
    assert.deepEqual(Object.keys(def.queries).sort(), ['npc.cast', 'npc.castMade', 'npc.catchUp', 'npc.dormantAfter', 'npc.dossier', 'npc.identity', 'npc.keyAway', 'npc.known', 'npc.meters', 'npc.next', 'npc.portrait', 'npc.present', 'npc.socialModifier']);
    assert.deepEqual([...QUERY_NAMES].sort(), Object.keys(def.queries).sort());
    assert.deepEqual(Object.keys(def.commands).sort(), ['npc.adjust', 'npc.drives', 'npc.flag', 'npc.meet', 'npc.milestone', 'npc.mood', 'npc.open', 'npc.refresh', 'npc.set', 'npc.taste', 'npc.tick']);
    assert.deepEqual(Object.keys(def.capture.kinds), ['npc', 'milestone', 'lie', 'know', 'taste', 'tie', 'memory', 'reveal']);
    assert.ok(['lie', 'know', 'taste', 'tie'].every(kind => def.capture.kinds[kind].feature === 'npc-state-delta.notes'), 'the note kinds belong to the notes feature');
    assert.equal(def.capture.kinds.milestone.feature, 'npc-state-delta.stages', 'the milestone kind belongs to the stages feature');
    assert.deepEqual(def.features.map(feature => [feature.id, feature.default]), [['npc-state-delta.stages', true], ['npc-state-delta.drift', false], ['npc-state-delta.presets', true], ['npc-state-delta.social', true], ['npc-state-delta.scan-every-reply', true], ['npc-state-delta.anti-lever', true], ['npc-state-delta.mood-pull', true], ['npc-state-delta.notes', true]]);
    assert.equal(typeof def.context.static, 'function', 'one static line for the npc kind; Delta keeps its own prompt keys besides');
    assert.equal(typeof def.settings.section, 'function');
    assert.deepEqual(Object.keys(def.settings.schema), ['changeCap', 'customMeters', 'stages', 'ladder', 'conflictAt', 'demoteAfter', 'gateDays', 'gateStrength', 'socialScale', 'socialCap']);
    assert.deepEqual(def.tabs.map(tab => [tab.id, tab.title]), [[CAST_TAB_ID, 'Dossiers']], 'the Cast tab is Dossiers now; its id stays `cast`');
    adapter.start();
    adapter.check();
    timers.runIntervals();
    timers.runTimeouts();
    await adapter.settled();
    assert.equal(sdk.registered.length, 1, 'never registered twice');
    assert.equal(adapter.hosted(), true);
});

test('a host that is there when Delta starts is found at once; `sdk` without `ready` works too', async () => {
    const sdk = fakeSdk();
    const { adapter, timers } = setup({ hostValue: { sdk } });
    adapter.start();
    assert.equal(await adapter.settled(), true);
    assert.equal(sdk.registered.length, 1);
    assert.equal(timers.timeouts.size, 0, 'nothing polls');
});

test('a registration the host refuses leaves Delta standalone and is not retried', async () => {
    const sdk = fakeSdk({ fail: true });
    const { adapter, warnings, dom, timers } = setup({ hostValue: v2Host(sdk) });
    adapter.start();
    assert.equal(await adapter.settled(), false);
    assert.equal(adapter.hosted(), false);
    assert.equal(warnings.length, 1);
    assert.equal(dom.panel.style.display, 'block');
    assert.equal(timers.timeouts.size + timers.intervals.size, 0);
});

test('a ready promise that rejects leaves Delta standalone', async () => {
    const ready = Promise.reject(new Error('host failed'));
    ready.catch(() => {});
    const { adapter, warnings, dom } = setup({ hostValue: { ready } });
    adapter.start();
    assert.equal(await adapter.settled(), false);
    assert.equal(adapter.hosted(), false);
    assert.equal(warnings.length, 1);
    assert.equal(dom.panel.style.display, 'block');
});

test('a host replaced while it gets ready is looked for again, within the same bound', async () => {
    const timers = fakeTimers();
    const fresh = () => v2Host(fakeSdk());
    const looping = createStorySuiteV2Adapter({ host: fresh, doc: fakeDocument(), timers, logger: { warn() {} }, loadEmptyCast: async () => null });
    looping.start();
    let rounds = 0;
    for (;;) {
        await looping.settled();
        if (!timers.runTimeouts()) break;
        rounds += 1;
    }
    assert.equal(rounds, HOST_RETRY_ATTEMPTS);
    assert.equal(looping.hosted(), false);
});

// ---- with a v2 host, nothing of v1 is offered (MODULES §D; v1 hosts unchanged) ----

test('the adapter tells the page when it is hosted and when the host goes away; never without a host', async () => {
    const { doc, box, timers, adapter } = await hosted();
    assert.deepEqual(doc.sent, [{ type: V2_HOST_EVENT, detail: { hosted: true } }]);
    box.host = undefined;
    timers.runIntervals();
    assert.deepEqual(doc.sent.at(-1), { type: V2_HOST_EVENT, detail: { hosted: false } });
    adapter.stop();
    assert.equal(doc.sent.length, 2, 'stop() after the host left sends nothing more');

    const alone = setup({ hostValue: { apiVersion: 1, registerTab() {} } });
    alone.adapter.start();
    while (alone.timers.runTimeouts());
    alone.adapter.stop();
    assert.deepEqual(alone.doc.sent, [], 'a v1 host or none: no event');
});

test('the hosted state (pageHandles.hosted) is set while hosted, before the event, and cleared when the host goes away or on stop()', async () => {
    const sdk = fakeSdk();
    const env = setup({ hostValue: v2Host(sdk) });
    const seen = [];
    env.doc.addEventListener(V2_HOST_EVENT, event => seen.push([event.detail.hosted, pageHandles.hosted]));
    env.adapter.start();
    assert.equal(await env.adapter.settled(), true);
    assert.equal(pageHandles.hosted, true);
    env.box.host = undefined;
    env.timers.runIntervals();
    assert.equal(pageHandles.hosted, false);
    assert.deepEqual(seen, [[true, true], [false, false]], 'listeners see the state already changed');

    const again = await hosted();
    assert.equal(pageHandles.hosted, true);
    again.adapter.stop();
    assert.equal(pageHandles.hosted, false);

    for (const hostValue of [undefined, { apiVersion: 1, registerTab() {} }]) {
        const alone = setup({ hostValue });
        alone.adapter.start();
        while (alone.timers.runTimeouts());
        assert.equal(pageHandles.hosted, false, 'never without a v2 host');
        alone.adapter.stop();
    }

    const refused = setup({ hostValue: v2Host(fakeSdk({ fail: true })) });
    refused.adapter.start();
    assert.equal(await refused.adapter.settled(), false);
    assert.equal(pageHandles.hosted, false, 'a refused registration is not hosting');
});

// ---- the hook in index.js ----

test('index.js starts the adapter once at startup through an optional import', () => {
    const index = runtimeSource();
    const calls = index.match(/import\('\.\/src\/storysuite-v2\.js'\)/g) || [];
    assert.equal(calls.length, 1);
    assert.match(index, /startStorySuiteV2\(\{ suiteApi: SUITE_API, panelId: UI_ID, version: NPC_STATE_VERSION, headReply: latestReplyIndex, castSync, castPortraitDue, cardSettings: nsdCardSettings\(\), linesMode: \(\) => true, levelOn: \(\) => rpgIsOn\(\) \}\)/);
    assert.equal(/from '\.\/src\/storysuite-v2\.js'/.test(index), false, 'no static import: a copy without src/ still loads');
});
