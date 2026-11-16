// The interaction guard is a valid version-2 guard that checks the recorded witness, refuses NOT_READY and ignores features.

import test from 'node:test';
import assert from 'node:assert/strict';
import { guardProblem, hashJson } from '../../../core/replay.js';
import { interactionGuard } from '../../../core/interaction/guard.js';
import { settleInteraction } from '../../../core/interaction/settle.js';

const state = { room: 1 };
const setup = { room: 1, foes: [{ name: 'Goblin' }] };
const step = { inputs: [{ actor: 'hero', choice: 'go' }] };
const actors = [{ id: 'hero', name: 'Astra', party: true }];

function probe(overrides = {}) {
    return {
        version: 1, title: 'Probe', feature: 'probe.feature', limits: {}, changes: ['probe.hurt'],
        ready: () => true,
        witness: now => ({ room: now.room }),
        validate: () => null,
        actors: () => actors,
        play: () => ({ view: {}, result: { stop: 'done' }, stop: 'done' }),
        settle: () => ({ result: { stop: 'done' }, changes: [{ type: 'probe.hurt', payload: { n: 1 } }], stop: 'done' }),
        note: () => ['Probe settled.'],
        ...overrides,
    };
}

function payloadFor(kind) {
    const id = 'reply-1:0:test/probe', anchor = 'reply-1', offset = 0;
    return {
        v: 1, kindId: 'test/probe', version: 1,
        key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:${offset}`,
        id, anchor, seed: 7, offset, setup, steps: [step],
        witness: { offset, hash: hashJson(kind.witness(state, setup)) }, player: 'hero', policy: { choosers: 'own', party: false },
    };
}

function settleOnce(kind, payload) {
    const guards = [];
    const ctx = {
        module: 'story-block', cause: 'system', caller: null, epoch: 'ep_k3f9a2qz', hash: hashJson,
        source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 },
        reply: { sid: 'sw_reply2' }, state,
        fail(code, message) { const error = new Error(message); error.code = code; throw error; },
        claim: () => true,
        call: () => ({ summary: 'done' }),
        replayGuard(guard, recorded) { guards.push({ guard: structuredClone(guard), recorded: structuredClone(recorded) }); },
    };
    settleInteraction(ctx, payload, kind, { state });
    assert.equal(guards.length, 1);
    return guards[0];
}

test('the guard a settle records passes guardProblem and is not replyBound', () => {
    const kind = probe(), payload = payloadFor(kind), stored = settleOnce(kind, payload);
    assert.equal(guardProblem(stored.guard), '');
    assert.equal(Object.hasOwn(stored.guard, 'replyBound'), false);
    assert.equal(stored.guard.predicate.kind, 'interaction');
    assert.equal(stored.guard.predicate.id, 'test/probe');
    assert.equal(stored.guard.predicate.setup, hashJson(payload));
});

test('replay passes on the same witness and fails on a changed one', () => {
    const kind = probe(), payload = payloadFor(kind), stored = settleOnce(kind, payload);
    const info = { ...stored, source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 } };
    assert.deepEqual(interactionGuard({ state, hash: hashJson }, info, kind), { ok: true });
    const changed = interactionGuard({ state: { room: 2 }, hash: hashJson }, info, kind);
    assert.equal(changed.ok, false);
    assert.equal(changed.code, 'CHANGED');
    assert.match(changed.reason, /Probe/);
});

test('a missing or unready kind answers NOT_READY', () => {
    const kind = probe(), payload = payloadFor(kind), stored = settleOnce(kind, payload);
    const info = { ...stored, source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 } };
    const missing = interactionGuard({ state, hash: hashJson }, info, () => null);
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'NOT_READY');
    const unready = interactionGuard({ state, hash: hashJson }, info, probe({ ready: () => false }));
    assert.equal(unready.ok, false);
    assert.equal(unready.code, 'NOT_READY');
});

test('a feature being off does not stop the guard', () => {
    const kind = probe(), payload = payloadFor(kind), stored = settleOnce(kind, payload);
    const info = { ...stored, source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 } };
    assert.equal(kind.feature, 'probe.feature');
    assert.deepEqual(interactionGuard({ state, hash: hashJson, feature: () => false }, info, kind), { ok: true });
});

test('a changed guard input, predicate or payload is refused as damaged', () => {
    const kind = probe(), payload = payloadFor(kind), stored = settleOnce(kind, payload);
    const info = { ...stored, source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 } };
    const forged = { ...stored.guard, inputHash: '0'.repeat(64) };
    assert.equal(interactionGuard({ state, hash: hashJson }, { ...info, guard: forged }, kind).ok, false);
    const moved = { ...stored.guard, predicate: { ...stored.guard.predicate, key: 'i:moved' } };
    assert.equal(interactionGuard({ state, hash: hashJson }, { ...info, guard: moved }, kind).ok, false);
    const edited = { ...payload, steps: [{ inputs: [{ actor: 'hero', choice: 'stay' }] }] };
    assert.equal(interactionGuard({ state, hash: hashJson }, { ...info, recorded: edited }, kind).ok, false);
});
