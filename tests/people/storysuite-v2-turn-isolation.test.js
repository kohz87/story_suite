// Delta's 'turn' and 'head' listeners are registered under its module id; with the host's suite.isolatedApply on, a cast step that was not kept
// reaches the host's listener guard as a rejection; with it off the step answers nothing (a warning only), exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createTurnPart } from '../src/adapter/cast-ui/turn.js';
import { createStorySuiteV2Adapter } from '../src/storysuite-v2.js';

const FLAG = 'suite.isolatedApply';

function part(answer, flagOn) {
    const session = { hosted: true, lastTick: null, sdkRef: flagOn === null ? {} : { flag: name => name === FLAG && flagOn } };
    const sent = [];
    const turn = createTurnPart(session, {
        castMade: () => ({}), castPeople: () => [], castPortraitDue: () => false, castSync: null, enabled: () => true, keyAwayMemory: () => ({}),
        keyPeopleAnswer: () => [], part: { tickWanted: () => true }, send: async (type, payload, options) => { sent.push([type, options]); return answer; },
        TICK_TURNS: ['reply'], warn() {},
    });
    return { turn, session, sent };
}

test('flag off or no flag reader: onTurn returns nothing and the step still goes out', async () => {
    for (const flagOn of [false, null]) {
        const { turn, session, sent } = part({ ok: false, code: 'FAILED', message: 'no' }, flagOn);
        assert.equal(turn.onTurn({ type: 'reply' }), undefined);
        assert.deepEqual(await session.lastTick, { ok: false, code: 'FAILED', message: 'no' });
        assert.deepEqual(sent, [['npc.tick', { own: true }]]);
    }
});

test('flag on: a step that was not kept rejects; a kept, refused or not-found one resolves', async () => {
    const bad = part({ ok: false, code: 'FAILED', message: 'no room' }, true);
    await assert.rejects(bad.turn.onTurn({ type: 'reply' }), /the cast step was not kept: no room/);
    for (const answer of [{ ok: true }, { ok: false, code: 'REFUSED' }, { ok: false, code: 'NOT_FOUND' }, null]) {
        const good = part(answer, true);
        assert.deepEqual(await good.turn.onTurn({ type: 'reply' }), answer);
    }
});

test('flag on: with nothing for the step to do, onTurn returns nothing', () => {
    const { turn } = part({ ok: true }, true);
    assert.equal(turn.onTurn({ type: 'unknown' }), undefined);
});

test('connect: Delta listens to turn and head under its own module id', async () => {
    const registered = [];
    const sdk = { registerModule: async () => {}, on: (name, fn, opts) => { registered.push([name, opts]); return () => {}; }, query: () => undefined, command: async () => null };
    const dataset = {};
    const doc = { documentElement: { dataset }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; }, createElement: () => ({ dataset: {}, style: {}, classList: { add() {}, remove() {} } }) };
    const host = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => [] }, delta: () => null, host: () => host, doc,
        timers: { setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout() {}, setInterval: () => 2, clearInterval() {} },
        loadEmptyCast: async () => null, logger: { warn() {} },
    });
    adapter.start();
    await new Promise(resolve => setTimeout(resolve, 20));
    await adapter.settled();
    adapter.stop?.();
    assert.deepEqual(registered, [['turn', { module: 'npc-state-delta' }], ['head', { module: 'npc-state-delta' }]]);
});
