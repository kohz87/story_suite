// A session records its first witness, player and policy, keeps only reader inputs, and refuses a changed setup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../src/v2/replay.js';
import { createSession, interactionKey, interactionPayload, stageInteraction } from '../../../src/v2/interaction/session.js';

const kind = {
    version: 1,
    title: 'Probe',
    limits: { steps: 5, stepInputs: 2 },
    witness: state => ({ room: state.room }),
    validate: (state, setup, steps, step) => (step.inputs[0]?.choice === 'go' ? null : 'Choose go.'),
    play: (state, setup, steps) => ({ view: { steps: steps.length }, result: { steps: steps.length }, stop: 'open' }),
};

const actors = [
    { id: 'hero', name: 'Astra', party: true, player: true },
    { id: 'mate', name: 'Ren', party: true },
];
const step = { inputs: [{ actor: 'hero', choice: 'go', args: { through: 'north' } }] };

test('create, name and stage one segment without storing derived fields in the payload', () => {
    const session = createSession({
        origin: 'reply-1', anchor: 'reply-1', attempt: 2, kindId: 'test/probe', version: 1, seed: 0x1234, setup: { room: 1 },
    });
    assert.equal(session.id, 'reply-1:2:test/probe');
    assert.equal(interactionKey(session), 'i:reply-1%3A2%3Atest%2Fprobe:reply-1:0');
    const staged = stageInteraction({ session, step, kind, kindId: 'test/probe', state: { room: 1 }, actors });
    assert.equal(staged.error, undefined, staged.error?.message);
    assert.deepEqual(staged.session.steps, [step]);
    assert.deepEqual(staged.preview.result, { steps: 1 });
    assert.equal(staged.session.player, 'hero');
    assert.deepEqual(staged.session.policy, { choosers: 'own', party: false });
    assert.deepEqual(staged.session.witness, { offset: 0, hash: hashJson({ room: 1 }) });
    const payload = interactionPayload(staged.session);
    assert.equal(payload.key, 'i:reply-1%3A2%3Atest%2Fprobe:reply-1:0');
    assert.equal(payload.witness.hash, hashJson({ room: 1 }));
    assert.equal(payload.player, 'hero');
    assert.deepEqual(payload.policy, { choosers: 'own', party: false });
    assert.equal(Object.hasOwn(payload, 'base'), false);
});

test('a changed witness refuses the next stage, and the recorded policy still governs it', () => {
    const session = createSession({ origin: 'r', anchor: 'r', kindId: 'test/probe', seed: 9, setup: { room: 1 } });
    const first = stageInteraction({ session, step, kind, kindId: 'test/probe', state: { room: 1 }, actors });
    assert.equal(first.error, undefined, first.error?.message);
    const changed = stageInteraction({ session: first.session, step, kind, kindId: 'test/probe', state: { room: 2 }, actors });
    assert.equal(changed.error.code, 'CHANGED');

    const companion = stageInteraction({
        session: first.session,
        step: { inputs: [{ actor: 'mate', choice: 'go' }] },
        kind,
        kindId: 'test/probe',
        state: { room: 1 },
        actors,
        policy: { choosers: 'party', partyKinds: ['test/probe'] },
    });
    assert.equal(companion.error.code, 'NOT_YOURS');
    assert.equal(first.session.steps.length, 1, 'a refusal changes nothing');
});
