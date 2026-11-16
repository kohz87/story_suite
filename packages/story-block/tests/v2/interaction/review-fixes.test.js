// Refusals carry ok:false, a stopped interaction takes no step, and policy, player, caller and JSON rules hold.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../src/v2/replay.js';
import { preludeDice } from '../../../src/v2/interaction/dice.js';
import { rng } from '../../../src/v2/rng.js';
import { positionalDice } from '../../../src/v2/lean-rpg/resolve/dice.js';
import { markPlayer } from '../../../src/v2/interaction/player.js';
import { policyProblem } from '../../../src/v2/interaction/policy.js';
import { settleInteraction } from '../../../src/v2/interaction/settle.js';
import { createInteractionApi } from '../../../src/v2/sdk/interaction.js';
import { PROBE_ID, PROBE_KIND, probeRegistry } from './helpers/probe-kind.js';

const go = { inputs: [{ actor: 'hero', choice: 'go' }] };

function api(kind = PROBE_KIND) {
    const meta = {};
    return createInteractionApi({ registry: probeRegistry(kind), meta: () => meta, chat: () => [], state: () => ({ room: 1 }), head: () => ({ sid: 'reply-1' }), persona: 'Astra' });
}

test('every sdk refusal carries ok:false and its code', () => {
    const a = api();
    for (const answer of [a.open('nope/x'), a.stage('none', go), a.auto('none'), a.send('none'), a.discard('none')]) {
        assert.equal(answer.ok, false);
        assert.equal(typeof answer.code, 'string');
    }
    const opened = a.open(PROBE_ID);
    assert.equal(a.open(PROBE_ID).ok, false);
    assert.equal(a.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'bad' }] }).ok, false);
});

test('stage is refused once the interaction has stopped', () => {
    const a = api({ ...PROBE_KIND, play: (...args) => ({ ...PROBE_KIND.play(...args), stop: 'done' }) });
    const opened = a.open(PROBE_ID);
    assert.equal(a.stage(opened.id, go).ok, true);
    const again = a.stage(opened.id, go);
    assert.equal(again.ok, false);
    assert.equal(again.code, 'ENDED');
});

test("choosers 'party' lets the reader choose for any party member", () => {
    const actors = markPlayer(PROBE_KIND.actors(), 'Astra');
    assert.equal(policyProblem({ choosers: 'party', partyKinds: [] }, 't/k', actors, { actor: 'mate' }), null);
    assert.equal(policyProblem({ choosers: 'own', partyKinds: [] }, 't/k', actors, { actor: 'mate' }).code, 'NOT_YOURS');
});

test('a kind without actors still has a player when the persona is empty', () => {
    const [actor] = markPlayer(undefined, '');
    assert.equal(actor.player, true);
    const { actors, ...bare } = PROBE_KIND;
    const meta = {};
    const a = createInteractionApi({ registry: probeRegistry({ ...bare, auto: undefined }), meta: () => meta, chat: () => [], state: () => ({}), head: () => ({ sid: 'r' }), persona: '' });
    const opened = a.open(PROBE_ID);
    const staged = a.stage(opened.id, { inputs: [{ actor: 'player', choice: 'go' }] });
    assert.equal(staged.ok, true, staged.message);
});

function ctxOf(extra = {}) {
    return { module: 'story-block', cause: 'system', caller: null, epoch: 'ep_k3f9a2qz', hash: hashJson, source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 },
        reply: { sid: 'reply-2' }, fail(code, message) { const error = new Error(message); error.code = code; throw error; },
        claim: () => true, call: () => ({}), replayGuard() {}, ...extra };
}

const segment = () => {
    const id = 'reply-1:0:test/probe';
    return { v: 1, kindId: PROBE_ID, version: 1, key: `i:${encodeURIComponent(id)}:reply-1:0`, id, anchor: 'reply-1', seed: 5, offset: 0, setup: { room: 1 },
        steps: [go], witness: { offset: 0, hash: hashJson(PROBE_KIND.witness({ room: 1 }, { room: 1 })) }, player: 'hero', policy: { choosers: 'own', party: false } };
};

test('settle refuses a nested or non-system caller', () => {
    for (const extra of [{ caller: 'other.cmd' }, { cause: 'ui' }]) {
        assert.throws(() => settleInteraction(ctxOf(extra), segment(), PROBE_KIND, { state: { room: 1 } }), error => error.code === 'REFUSED');
    }
});

test('a result that is not plain JSON is a refusal, not an exception', () => {
    const kind = { ...PROBE_KIND, settle: () => ({ result: { stop: 'done', fn: () => 1 }, changes: [] }) };
    assert.throws(() => settleInteraction(ctxOf(), segment(), kind, { state: { room: 1 } }), error => error.code === 'INVALID');
});

test('the opening prelude source is the host positional source on the base drawn from the seed', () => {
    let differs = 0;
    for (let seed = 0; seed < 200; seed += 7) {
        const base = Math.floor(rng(seed)() * 4294967296) >>> 0;
        const mine = preludeDice(seed), host = positionalDice(base), raw = positionalDice(seed);
        for (const [lane, name] of [[1, 'act'], [2, 'foe'], [3, 'check'], [4, 'init'], [5, 'open']]) {
            for (let at = 0; at < 4; at += 1) {
                const x = mine(lane, at), y = host(name, at), z = raw(name, at);
                for (let i = 0; i < 6; i += 1) {
                    const got = x();
                    assert.equal(got, y());
                    if (got !== z()) differs += 1;
                }
            }
        }
    }
    assert.ok(differs > 100, 'a raw-seed base would give other numbers');
});
