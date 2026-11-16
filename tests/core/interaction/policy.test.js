// The policy lets the reader choose for their own actor, and for every party member in fights only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_ACTION_POLICY, policyProblem } from '../../../src/v2/interaction/policy.js';

const actors = [
    { id: 'hero', name: 'Astra', party: true, player: true },
    { id: 'mate', name: 'Ren', party: true },
    { id: 'npc', name: 'Innkeeper', party: false },
];

test('the owner rule is the one recorded constant', () => {
    assert.deepEqual(STORY_ACTION_POLICY, {
        choosers: 'own',
        partyKinds: ['story-block/fight'],
        othersBy: 'code-or-model',
    });
    assert.equal(Object.isFrozen(STORY_ACTION_POLICY), true);
});

test('own, party, recorded and missing-player cases all use NOT_YOURS', () => {
    assert.equal(policyProblem(STORY_ACTION_POLICY, 'test/probe', actors, { actor: 'hero' }), null);
    assert.equal(policyProblem(STORY_ACTION_POLICY, 'test/probe', actors, { actor: 'mate' }).code, 'NOT_YOURS');
    assert.equal(policyProblem(STORY_ACTION_POLICY, 'story-block/fight', actors, { actor: 'mate' }), null);
    assert.equal(policyProblem(STORY_ACTION_POLICY, 'story-block/fight', actors, { actor: 'npc' }).code, 'NOT_YOURS');
    assert.equal(policyProblem({ choosers: 'party', party: true }, 'test/probe', actors, { actor: 'mate' }), null);
    assert.equal(policyProblem({ choosers: 'own', party: false }, 'test/probe', actors, { actor: 'mate' }).code, 'NOT_YOURS');
    assert.equal(policyProblem(STORY_ACTION_POLICY, 'test/probe', actors, { actor: 'missing' }).code, 'NOT_YOURS');
    assert.match(policyProblem(STORY_ACTION_POLICY, 'test/probe', actors.filter(actor => !actor.player), { actor: 'mate' }).message,
        /Your own character is not on the Probe/);
});
