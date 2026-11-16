// Derived inputs are deterministic from the seed and a stored input for a non-chooseable actor is refused.

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStep, deriveSteps } from '../../../src/v2/interaction/derive.js';
import { dice } from '../../../src/v2/interaction/dice.js';

const actors = [
    { id: 'hero', name: 'Astra', party: true, player: true },
    { id: 'mate', name: 'Ren', party: true },
];
const policy = { choosers: 'own', partyKinds: [], othersBy: 'code-or-model' };
const kind = {
    title: 'Probe',
    auto: (state, setup, steps, actorId, diceAt) => {
        const roll = diceAt(0, 0, 1000);
        const value = roll();
        return { choice: value % 2 ? 'help' : 'wait', args: { value, after: steps.length } };
    },
};
const step = { inputs: [{ actor: 'hero', choice: 'go' }] };
const run = seed => deriveStep({ kind, kindId: 'test/probe', state: {}, setup: {}, step, actors, policy,
    dice: index => dice(seed, 0)(index) });

test('the same seed gives the same companion input, completed only for play', () => {
    const first = run(123), second = run(123);
    assert.equal(first.error, undefined, first.error?.message);
    assert.deepEqual(first.derived, second.derived);
    assert.equal(first.derived.length, 1);
    assert.equal(first.derived[0].actor, 'mate');
    assert.equal(first.step.inputs.length, 2);
    assert.equal(step.inputs.length, 1, 'the stored step stays reader-only');
    assert.equal(run(124).derived[0].args.value === first.derived[0].args.value
        && run(124).derived[0].choice === first.derived[0].choice, false);
});

test('a stored input for a companion under an own-character policy is NOT_YOURS', () => {
    const refused = deriveStep({ kind, kindId: 'test/probe', state: {}, setup: {},
        step: { inputs: [{ actor: 'hero', choice: 'go' }, { actor: 'mate', choice: 'help' }] }, actors, policy,
        dice: index => dice(7, 0)(index) });
    assert.equal(refused.error.code, 'NOT_YOURS');

    const allowed = deriveStep({ kind, kindId: 'story-block/fight', state: {}, setup: {},
        step: { inputs: [{ actor: 'hero', choice: 'go' }, { actor: 'mate', choice: 'help' }] }, actors,
        policy: { choosers: 'party', partyKinds: ['story-block/fight'] }, dice: index => dice(7, 0)(index) });
    assert.equal(allowed.error, undefined, allowed.error?.message);
    assert.deepEqual(allowed.derived, []);
    const all = deriveSteps({ kind, kindId: 'test/probe', state: {}, setup: {}, steps: [step, step], actors, policy,
        dice: index => dice(123, 0)(index) });
    assert.equal(all.steps.length, 2);
    assert.equal(all.derived.length, 2);
});
