// The probe kind runs the whole open, stage, send, settle and guard path; carried segments and swipes replay as they ran live.

import test from 'node:test';
import assert from 'node:assert/strict';
import { guardProblem, hashJson } from '../../../src/v2/replay.js';
import { interactionGuard } from '../../../src/v2/interaction/guard.js';
import { receiveSegment, reconcileSession } from '../../../src/v2/interaction/carry.js';
import { interactionPayload } from '../../../src/v2/interaction/session.js';
import { settleInteraction } from '../../../src/v2/interaction/settle.js';
import { createInteractionApi } from '../../../src/v2/sdk/interaction.js';
import { PROBE_ID, PROBE_KIND, probeRegistry } from './helpers/probe-kind.js';

const SOURCE = { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 };
const state = { room: 1 };

function ctxFor(sid, receipts = []) {
    const guards = [];
    return {
        module: 'story-block', cause: 'system', caller: null, epoch: 'ep_k3f9a2qz', hash: hashJson, source: SOURCE, reply: { sid }, state,
        fail(code, message) { const error = new Error(message); error.code = code; throw error; },
        claim: () => true, call: () => ({ summary: 'done' }), receipts: () => receipts, guards,
        replayGuard(guard, recorded) { guards.push({ guard: structuredClone(guard), recorded: structuredClone(recorded), source: SOURCE }); },
    };
}

function harness(sid = 'reply-1') {
    const meta = {};
    const api = createInteractionApi({ registry: probeRegistry(), meta: () => meta, chat: () => [], state: () => state, head: () => ({ sid }), persona: 'Astra' });
    return { api, meta, box: () => meta.storySuiteInteraction };
}

const go = { inputs: [{ actor: 'hero', choice: 'go' }] };

test('open, stage, settle and guard run on the probe kind for a segment', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    assert.equal(h.api.stage(opened.id, go).ok, true);
    const payload = interactionPayload(h.box().open), ctx = ctxFor('reply-2');
    const receipt = settleInteraction(ctx, payload, PROBE_KIND, { state });
    assert.equal(receipt.data.interaction.stop, 'open');
    assert.equal(Number.isInteger(receipt.data.v2.result.roll), true);
    assert.equal(guardProblem(ctx.guards[0].guard), '');
    assert.deepEqual(interactionGuard({ state, hash: hashJson }, ctx.guards[0], PROBE_KIND), { ok: true });
});

test('an opening-only payload settles on the probe kind with the opening note', () => {
    const payload = { v: 1, kindId: PROBE_ID, version: 1, key: `i:${encodeURIComponent('reply-1:0:test/probe')}:reply-1:0`, id: 'reply-1:0:test/probe',
        anchor: 'reply-1', seed: 77, offset: 0, setup: { room: 1 }, steps: [], witness: null, opening: true };
    const receipt = settleInteraction(ctxFor('reply-2'), payload, PROBE_KIND, { state });
    assert.match(receipt.summary, /opens/);
    assert.equal(Number.isInteger(receipt.data.v2.result.opened), true);
});

test('a carried segment settles against the first segment receipt, through three segments', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    h.api.stage(opened.id, go);
    const p1 = interactionPayload(h.box().open), receipts = [];
    const r1 = settleInteraction(ctxFor('reply-2'), p1, PROBE_KIND, { state });
    receipts.push({ type: 'interaction.settle', replan: { payload: p1 }, data: r1.data });
    const meta = { open: structuredClone(h.box().open) };
    assert.equal(receiveSegment(meta, PROBE_KIND, p1, r1.data.v2.result, 'reply-2', 'rc1', state), true);
    h.box().open = meta.open;
    h.api.stage(meta.open.id, go);
    const p2 = interactionPayload(h.box().open);
    const r2 = settleInteraction(ctxFor('reply-3', receipts), p2, PROBE_KIND, { state });
    receipts.push({ type: 'interaction.settle', replan: { payload: p2 }, data: r2.data });
    assert.equal(receiveSegment(meta, PROBE_KIND, p2, r2.data.v2.result, 'reply-3', 'rc2', state), true);
    assert.equal(meta.open.offset, 2);
    assert.deepEqual(meta.open.base.setup, p2.setup);
    assert.equal(meta.open.base.offset, 1);
    assert.equal(meta.open.base.anchor, 'reply-2');
    assert.equal(meta.open.base.carried, 'rc1');
    assert.equal(meta.open.base.prior, p2.prior);
    // Take back segment 3's carrier: the session goes back to segment 2, with its own carry fields.
    meta.open.steps = [];
    reconcileSession(meta, id => id !== 'rc2');
    assert.equal(meta.open.offset, 1);
    assert.equal(meta.open.anchor, 'reply-2');
    assert.deepEqual(meta.open.setup, p2.setup);
    assert.equal(meta.open.carried, 'rc1');
    assert.equal(meta.open.carriedKey, p1.key);
    assert.equal(meta.open.prior, p2.prior);
    assert.equal(meta.open.base.offset, 0);
});

test('receiving the same segment again keeps the staged steps and only re-anchors', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    h.api.stage(opened.id, go);
    const p1 = interactionPayload(h.box().open);
    const result = settleInteraction(ctxFor('reply-2'), p1, PROBE_KIND, { state }).data.v2.result;
    const meta = { open: structuredClone(h.box().open) };
    receiveSegment(meta, PROBE_KIND, p1, result, 'reply-2', 'rc1', state);
    h.box().open = meta.open;
    h.api.stage(meta.open.id, go);
    const staged = structuredClone(h.box().open);
    meta.open = structuredClone(staged);
    assert.equal(receiveSegment(meta, PROBE_KIND, p1, result, 'reply-2b', 'rc1b', state), true);
    assert.equal(meta.open.steps.length, 1);
    assert.equal(meta.open.anchor, 'reply-2b');
    assert.equal(meta.open.carried, 'rc1b');
    assert.deepEqual(meta.open.witness, staged.witness);
    assert.deepEqual(meta.open.base, staged.base);
    // A swipe that settles differently rebuilds the session and drops the stale steps.
    assert.equal(receiveSegment(meta, PROBE_KIND, p1, { ...result, steps: 9 }, 'reply-2c', 'rc1c', state), true);
    assert.equal(meta.open.steps.length, 0);
});
