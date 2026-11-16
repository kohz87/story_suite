// The interaction sdk opens, stages, auto-plays, sends and discards one chat interaction through a stub registry.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashText } from '../../../modules/assist/common.js';
import { interactionSeed } from '../../../core/interaction/dice.js';
import { interactionPayload } from '../../../core/interaction/session.js';
import { createInteractionApi } from '../../../core/sdk/interaction.js';
import { PROBE_ID, PROBE_KIND, probeRegistry } from './helpers/probe-kind.js';

const anchorMessage = { is_user: false, mes: '', extra: { storySuite: { v: 2, ops: [], receipts: [], narrated: [], sid: 'reply-1' } } };

function harness({ kind = PROBE_KIND, featureOn = () => true, head = () => ({ sid: 'reply-1' }), state = { room: 1 } } = {}) {
    const meta = {}, chat = [];
    let saves = 0;
    const api = createInteractionApi({
        registry: probeRegistry(kind),
        meta: () => meta,
        chat: () => chat,
        state: () => state,
        head,
        persona: 'Astra',
        featureOn,
        save: () => { saves += 1; },
    });
    return { api, meta, chat, state, saves: () => saves };
}

test('open reads the head reply and stores one seeded session; a second open is busy', () => {
    const h = harness();
    const opened = h.api.open(PROBE_ID, { door: 'east' });
    assert.equal(opened.ok, true, opened.message);
    assert.equal(opened.state, 'open');
    assert.equal(opened.title, 'Probe');
    assert.equal(opened.canSend, false);
    assert.deepEqual(opened.steps, []);
    assert.deepEqual(opened.view, { lines: [], choices: [{ id: 'go', label: 'Go on', actor: 'hero' }], room: 1 });

    const session = h.meta.storySuiteInteraction.open;
    assert.equal(session.id, 'reply-1:0:test/probe');
    assert.equal(session.anchor, 'reply-1');
    assert.equal(session.seed, interactionSeed('reply-1', 0, PROBE_ID));
    assert.equal(session.version, 1);
    assert.deepEqual(session.setup, { room: 1, door: 'east', anchor: 'reply-1', seed: session.seed });
    assert.equal(h.saves(), 1);
    assert.equal(h.api.open(PROBE_ID).code, 'BUSY');
});

test('stage keeps only the reader input, derives the companion and records player and policy', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    const staged = h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'go' }] });
    assert.equal(staged.ok, true, staged.message);
    assert.equal(staged.state, 'staged');
    assert.deepEqual(staged.steps, [{ inputs: [{ actor: 'hero', choice: 'go' }] }]);
    assert.deepEqual(staged.view.lines, ['hero:go,mate:hum']);
    assert.equal(staged.view.room, 1);
    assert.equal(h.meta.storySuiteInteraction.open.steps.length, 1);
    assert.deepEqual(h.meta.storySuiteInteraction.open.steps[0].inputs.map(input => input.actor), ['hero']);
    assert.equal(h.meta.storySuiteInteraction.open.player, 'hero');
    assert.deepEqual(h.meta.storySuiteInteraction.open.policy, { choosers: 'own', party: false });
    const { ok, ...current } = staged;
    assert.deepEqual(h.api.current(), current);

    const before = structuredClone(h.meta.storySuiteInteraction.open);
    const bad = h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'dance' }] });
    assert.equal(bad.code, 'INVALID');
    assert.deepEqual(h.meta.storySuiteInteraction.open, before);
    h.state.room = 2;
    assert.equal(h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'go' }] }).code, 'CHANGED');
});

test('auto stages ordinary steps for the reader actor and derives the same companion every time', () => {
    const run = () => {
        const h = harness(), opened = h.api.open(PROBE_ID);
        const played = h.api.auto(opened.id, 2);
        assert.equal(played.ok, true, played.message);
        assert.equal(played.staged, 2);
        assert.equal(played.steps.length, 2);
        assert.deepEqual(played.view.lines, ['hero:go,mate:hum', 'hero:go,mate:hum']);
        assert.ok(h.meta.storySuiteInteraction.open.steps.every(step => step.inputs.length === 1 && step.inputs[0].actor === 'hero'));
        return h.meta.storySuiteInteraction.open.steps;
    };
    const first = run(), second = run();
    assert.deepEqual(first, second);

    const { auto, ...withoutAuto } = PROBE_KIND;
    const h = harness({ kind: withoutAuto }), opened = h.api.open(PROBE_ID);
    assert.equal(h.api.auto(opened.id, 1).code, 'REFUSED');
});

test('send copies the exact payload beside the waiting message; discard advances the next seed', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    assert.equal(h.api.send(opened.id).code, 'NO_INPUT');
    h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'go' }] });
    h.chat.push(anchorMessage, { is_user: true, mes: '  Go on.  ' });
    const sent = h.api.send(opened.id);
    assert.equal(sent.ok, true, sent.message);
    assert.equal(sent.state, 'sent');
    assert.equal(sent.canSend, false);
    assert.deepEqual(h.meta.storySuiteInteraction.send, {
        anchor: 'reply-1', message: hashText('Go on.'), payload: interactionPayload(h.meta.storySuiteInteraction.open),
    });

    const discarded = h.api.discard(opened.id);
    assert.equal(discarded.discarded, true);
    assert.equal(h.meta.storySuiteInteraction.open, undefined);
    assert.equal(h.meta.storySuiteInteraction.send, undefined);
    assert.equal(h.meta.storySuiteInteraction.attempts['reply-1'], 1);
    assert.equal(h.api.current(), null);

    const again = h.api.open(PROBE_ID);
    assert.equal(again.id, 'reply-1:1:test/probe');
    assert.equal(h.meta.storySuiteInteraction.open.seed, interactionSeed('reply-1', 1, PROBE_ID));
});

test('open carries a waiting opening; the probe covers opening, carry and its marker word', () => {
    const h = harness();
    h.meta.storySuiteInteraction = {
        start: { anchor: 'reply-1', kindId: PROBE_ID, opening: { payload: { opened: 3 }, seed: 77 } },
    };
    const opened = h.api.open(PROBE_ID);
    assert.equal(opened.ok, true, opened.message);
    assert.deepEqual(h.meta.storySuiteInteraction.open.opening, { payload: { opened: 3 }, seed: 77 });
    assert.deepEqual(PROBE_KIND.opening({ room: 1 }, {}, (lane, at) => () => lane + at), { result: { opened: 5 }, changes: [] });
    assert.deepEqual(PROBE_KIND.next(h.meta.storySuiteInteraction.open.setup, { steps: 2 }, h.state),
        { ...h.meta.storySuiteInteraction.open.setup, room: 2, carried: 2 });
    assert.deepEqual(PROBE_KIND.marker, { word: 'probe' });
});

test('refusals never throw or leave a half-open session', () => {
    const off = harness({ kind: { ...PROBE_KIND, feature: 'test.probe' }, featureOn: () => false });
    assert.equal(off.api.open(PROBE_ID).code, 'FEATURE_OFF');
    const lazy = harness({ kind: { ...PROBE_KIND, ready: () => false } });
    assert.equal(lazy.api.open(PROBE_ID).code, 'NOT_READY');
    const noReply = harness({ head: () => null });
    assert.equal(noReply.api.open(PROBE_ID).code, 'NO_REPLY');
    assert.deepEqual(noReply.meta, {});
    assert.equal(noReply.api.open('missing/kind').code, 'NOT_READY');
    assert.equal(noReply.api.stage('missing', { inputs: [] }).code, 'ENDED');
    const throwing = harness({ kind: { ...PROBE_KIND, open: () => { throw new Error('no room'); } } });
    const refused = throwing.api.open(PROBE_ID);
    assert.equal(refused.code, 'INVALID');
    assert.match(refused.message, /no room/u);
    assert.deepEqual(throwing.meta, {});
});

test('send refuses a changed witness', () => {
    const h = harness(), opened = h.api.open(PROBE_ID);
    h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'go' }] });
    h.chat.push(anchorMessage, { is_user: true, mes: 'Go on.' });
    h.state.room = 9;
    assert.equal(h.api.send(opened.id).code, 'CHANGED');
    assert.equal(h.meta.storySuiteInteraction.send, undefined);
});
