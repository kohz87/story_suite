// Settle claims once, keeps the change allow-list and caps, fails atomically, and uses the recorded policy, witness and prior result.

import test from 'node:test';
import assert from 'node:assert/strict';
import { guardProblem, hashJson } from '../../../src/v2/replay.js';
import { settleInteraction } from '../../../src/v2/interaction/settle.js';

const state = { room: 1 };
const setup = { room: 1, rules: { pace: 'normal' }, foes: [{ name: 'Goblin' }] };
const actors = [
    { id: 'hero', name: 'Astra', party: true, player: true },
    { id: 'mate', name: 'Ren', party: true },
];
const oneStep = { inputs: [{ actor: 'hero', choice: 'go', args: { through: 'north' } }] };

function kindFor(overrides = {}) {
    const log = { play: 0, settle: 0, opening: 0, note: [], played: [], settled: [] };
    const kind = {
        version: 1,
        title: 'Probe',
        feature: null,
        limits: {},
        changes: ['probe.hurt', 'probe.gain'],
        ready: () => true,
        witness: now => ({ room: now.room }),
        validate: () => null,
        actors: () => actors,
        play: (now, opened, steps) => {
            log.play += 1;
            log.played.push(steps);
            return { view: { steps: steps.length }, result: { steps: steps.length, stop: 'open' }, stop: 'open' };
        },
        settle: (now, opened, steps) => {
            log.settle += 1;
            log.settled.push(steps);
            return { result: { steps: steps.length, stop: 'done' }, changes: [], stop: 'done' };
        },
        opening: () => {
            log.opening += 1;
            return { result: { opened: ['Goblin'], stop: 'open' }, changes: [{ type: 'probe.gain', payload: { qty: 1 } }] };
        },
        note: (result, opened, options) => {
            log.note.push({ result, opened, options });
            return [`Probe settled ${result.steps ?? result.opened.length}.`];
        },
    };
    return { kind: { ...kind, ...overrides }, log };
}

function payloadFor(kind, extra = {}) {
    const id = extra.id ?? 'reply-1:0:test/probe';
    const anchor = extra.anchor ?? 'reply-1';
    const offset = extra.offset ?? 0;
    const opening = extra.opening === true;
    const base = {
        v: 1,
        kindId: extra.kindId ?? 'test/probe',
        version: extra.version ?? kind.version,
        key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:${offset}`,
        id,
        anchor,
        seed: extra.seed ?? 7,
        offset,
        setup: extra.setup ?? setup,
        steps: extra.steps ?? (opening ? [] : [oneStep]),
        witness: opening ? null : (extra.witness ?? { offset, hash: hashJson(kind.witness(state, extra.setup ?? setup)) }),
    };
    if (!opening) {
        base.player = extra.player ?? 'hero';
        base.policy = extra.policy ?? { choosers: 'own', party: false };
    }
    if (opening) base.opening = true;
    if (extra.prior !== undefined) base.prior = extra.prior;
    if (extra.carriedKey !== undefined) base.carriedKey = extra.carriedKey;
    return { ...base, ...Object.fromEntries(Object.entries(extra).filter(([key]) => ![
        'id', 'anchor', 'offset', 'kindId', 'version', 'seed', 'setup', 'steps', 'witness', 'player', 'policy', 'opening', 'prior', 'carriedKey',
    ].includes(key))) };
}

function ctxFor({ now = state, sid = 'sw_reply2', call = null, receipts = null } = {}) {
    const claims = new Set(), calls = [], guards = [];
    const fail = (code, message) => {
        const error = new Error(message);
        error.code = code;
        throw error;
    };
    return {
        module: 'story-block', cause: 'system', caller: null, epoch: 'ep_k3f9a2qz', state: now,
        source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 },
        reply: { sid }, hash: hashJson, fail, claims, calls, guards,
        claim(key) { if (claims.has(key)) return false; claims.add(key); return true; },
        call(type, payload) { calls.push({ type, payload }); return call ? call(type, payload) : { summary: `${type} done.` }; },
        replayGuard(guard, recorded) { guards.push({ guard: structuredClone(guard), recorded: structuredClone(recorded) }); },
        ...(receipts ? { receipts: () => receipts } : {}),
    };
}

const refused = code => error => error?.code === code;

test('a settle claims its reply once, records a valid guard and returns the receipt shape', () => {
    const { kind } = kindFor();
    const payload = payloadFor(kind), ctx = ctxFor();
    const receipt = settleInteraction(ctx, payload, kind, { state });
    const claimId = `ia:test/probe:${payload.key}:reply:sw_reply2`;
    assert.equal(ctx.claims.has(claimId), true);
    assert.equal(receipt.replan, true);
    assert.equal(receipt.narrate, true);
    assert.equal(receipt.summary, 'Probe settled 1.');
    assert.equal(receipt.data.v2.key, claimId);
    assert.deepEqual(receipt.data.v2.result, { steps: 1, stop: 'done' });
    assert.deepEqual(receipt.data.interaction, { module: 'test', kind: 'probe', key: payload.key, stop: 'done', changes: [] });
    assert.equal(ctx.guards.length, 1);
    assert.equal(guardProblem(ctx.guards[0].guard), '');
    assert.equal(Object.hasOwn(ctx.guards[0].guard, 'replyBound'), false);
    assert.deepEqual(ctx.guards[0].recorded, payload);
    assert.equal(ctx.calls.length, 0);
    assert.equal(ctxFor().claims.size, 0, 'a failed settle does not touch another reply');

    assert.throws(() => settleInteraction(ctx, payload, kind, { state }), refused('CLAIMED'));
});

test('the change allow-list and the change cap refuse before any command is called', () => {
    const notAllowed = kindFor({ settle: () => ({ result: { stop: 'done' }, stop: 'done', changes: [{ type: 'probe.steal', payload: {} }] }) });
    const first = ctxFor();
    assert.throws(() => settleInteraction(first, payloadFor(notAllowed.kind), notAllowed.kind, { state }), refused('INVALID'));
    assert.equal(first.calls.length, 0);
    assert.equal(first.claims.size, 0);

    const tooMany = kindFor({ limits: { changes: 1 }, settle: () => ({ result: { stop: 'done' }, stop: 'done',
        changes: [{ type: 'probe.hurt', payload: { n: 1 } }, { type: 'probe.gain', payload: { n: 1 } }] }) });
    const second = ctxFor();
    assert.throws(() => settleInteraction(second, payloadFor(tooMany.kind), tooMany.kind, { state }), refused('TOO_BIG'));
    assert.equal(second.calls.length, 0);
    assert.equal(second.claims.size, 0);
});

test('a failing command fails the whole settle and no receipt is returned', () => {
    const { kind } = kindFor({ settle: () => ({ result: { steps: 1, stop: 'done' }, stop: 'done',
        changes: [{ type: 'probe.hurt', payload: { n: 1 } }, { type: 'probe.gain', payload: { n: 1 } }] }) });
    const ctx = ctxFor({ call: (type) => {
        if (type === 'probe.gain') ctx.fail('REFUSED', 'The bag is full.');
        return { summary: `${type} done.` };
    } });
    assert.throws(() => settleInteraction(ctx, payloadFor(kind), kind, { state }), refused('REFUSED'));
    assert.deepEqual(ctx.calls.map(call => call.type), ['probe.hurt', 'probe.gain']);
    assert.equal(ctx.calls.every(call => call.payload && typeof call.payload === 'object'), true);
});

test('the recorded policy and player govern settle, not today\'s party rule', () => {
    const { kind, log } = kindFor();
    const payload = payloadFor(kind, { steps: [{ inputs: [{ actor: 'hero', choice: 'go' }, { actor: 'mate', choice: 'go' }] }] });
    const ctx = ctxFor();
    assert.throws(() => settleInteraction(ctx, payload, kind, { state }), refused('NOT_YOURS'));
    assert.equal(log.play, 0);
    assert.equal(ctx.claims.size, 0);
});

test('the payload witness is checked again on every replay', () => {
    const { kind } = kindFor();
    const payload = payloadFor(kind);
    assert.doesNotThrow(() => settleInteraction(ctxFor(), payload, kind, { state }));
    const replay = ctxFor({ now: { room: 2 } });
    assert.throws(() => settleInteraction(replay, payload, kind, { state: replay.state }), refused('NO_LONGER_DONE'));
    assert.equal(replay.claims.size, 0);
});

test('an opening-only payload settles the opening and never calls play or settle', () => {
    const { kind, log } = kindFor();
    const payload = payloadFor(kind, { opening: true });
    const ctx = ctxFor();
    const receipt = settleInteraction(ctx, payload, kind, { state });
    assert.equal(log.opening, 1);
    assert.equal(log.play, 0);
    assert.equal(log.settle, 0);
    assert.deepEqual(receipt.data.v2.result, { opened: ['Goblin'], stop: 'open' });
    assert.equal(receipt.data.interaction.stop, 'open');
    assert.deepEqual(receipt.data.interaction.changes, [{ type: 'probe.gain', summary: 'probe.gain done.' }]);
    assert.equal(ctx.claims.size, 1);
});

test('derived inputs are re-derived from the seed, not read from the stored step', () => {
    let settledSteps = null;
    const { kind } = kindFor({
        auto: (now, opened, steps, actor, source) => ({ choice: 'help', args: { roll: source(0, 0, 1000)() } }),
        play: (now, opened, steps) => ({ view: { steps: steps.length }, result: { stop: 'open' }, stop: 'open' }),
        settle: (now, opened, steps) => {
            settledSteps = steps;
            return { result: { actors: steps[0].inputs.map(input => input.actor), stop: 'done' }, stop: 'done' };
        },
        note: result => [`Probe ${result.actors.join(' and ')}.`],
    });
    const payload = payloadFor(kind), ctx = ctxFor();
    const receipt = settleInteraction(ctx, payload, kind, { state });
    assert.deepEqual(settledSteps[0].inputs.map(input => input.actor), ['hero', 'mate']);
    assert.deepEqual(receipt.data.v2.result.actors, ['hero', 'mate']);
    assert.equal(payload.steps[0].inputs.length, 1, 'the stored step stays reader-only');
});

test('a carried segment needs its earlier result, and a changed earlier result stops the settle', () => {
    const { kind } = kindFor();
    const previous = { steps: 1, stop: 'open' };
    const carriedKey = 'i:earlier:reply-1:0';
    const payload = payloadFor(kind, { offset: 1, prior: hashJson(previous), carriedKey });
    const receipt = { type: 'interaction.settle', replan: { payload: { key: carriedKey } }, data: { v2: { result: previous } } };
    assert.doesNotThrow(() => settleInteraction(ctxFor({ receipts: [{ index: 0, receipt }] }), payload, kind, { state }));
    const changed = { ...receipt, data: { v2: { result: { steps: 2, stop: 'open' } } } };
    assert.throws(() => settleInteraction(ctxFor({ receipts: [{ index: 0, receipt: changed }] }), payload, kind, { state }), refused('NO_LONGER_DONE'));
    assert.throws(() => settleInteraction(ctxFor(), payload, kind, { state }), refused('NO_LONGER_DONE'));
});

test('the note is told the interaction note allowance', () => {
    const { kind, log } = kindFor();
    settleInteraction(ctxFor(), payloadFor(kind), kind, { state });
    assert.equal(log.note.length, 1);
    assert.equal(log.note[0].options.tokens, 600);
});
