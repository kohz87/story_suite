// A Combat Rules v1 Foes group has no hurt of its own (the fight keeps each foe's HP), so a filled slot is a standing group: the readers that ask "is a fight on?" (the pre-call, the opening) see it, and an empty slot is not one. Without this a v1 chat would send "No foes are set" while a fight stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../../../modules/rpg/read.js';
import { v1Blocks } from './board/v1.helpers.js';
import { fightOn } from '../../../modules/cast/cast/entries.js';
import { fakeState } from './view/helpers.js';

const stateOf = count => {
    const { foes } = v1Blocks({ count });
    return fakeState([{ definition: { ...foes.definition, slug: 'foes' }, fields: foes.fields }]);
};

test('a filled v1 foe slot is standing (hurt 1), an empty one is not (hurt 0)', () => {
    const foes = readSheet(stateOf(3)).foes;
    assert.deepEqual([foes[0].filled, foes[0].hurt, foes[1].filled, foes[1].hurt], [true, 1, false, 0]);
    assert.deepEqual(readSheet(stateOf(0)).foes.map(foe => foe.hurt), [0, 0, 0, 0, 0, 0]);
});

test('a filled v1 foe slot is a fight on for the cast and the world pulse (their readers stop at a Foes block with no hurt field otherwise)', () => {
    assert.equal(fightOn(() => null, stateOf(3), { leanOn: true }), true);
    assert.equal(fightOn(() => null, stateOf(0), { leanOn: true }), false);
});
