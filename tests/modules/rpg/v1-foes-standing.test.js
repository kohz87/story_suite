// A Combat Rules v1 Foes group has no hurt of its own (the fight keeps each foe's HP), so a filled slot is a standing group: the readers that ask "is a fight on?" (the prompt diet's quiet reply,
// the pre-call, the opening) see it, and an empty slot is not one. Without this a v1 chat would send "No foes are set" and drop the Combat rules text while a fight stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../../../modules/rpg/read.js';
import { fightIsOpen, isQuiet } from '../../../modules/rpg/quiet.js';
import { v1Blocks } from './board/v1.helpers.js';
import { fakeState } from './view/helpers.js';
import { LEAN_RPG_FEATURE } from '../../../modules/rpg/names.js';

const stateOf = count => {
    const { foes } = v1Blocks({ count });
    return fakeState([{ definition: { ...foes.definition, slug: 'foes' }, fields: foes.fields }]);
};

test('a filled v1 foe slot is standing (hurt 1), an empty one is not (hurt 0)', () => {
    const foes = readSheet(stateOf(3)).foes;
    assert.deepEqual([foes[0].filled, foes[0].hurt, foes[1].filled, foes[1].hurt], [true, 1, false, 0]);
    assert.deepEqual(readSheet(stateOf(0)).foes.map(foe => foe.hurt), [0, 0, 0, 0, 0, 0]);
});

test('the prompt diet: a reply is quiet only when no v1 group stands', () => {
    const hint = state => ({ view: { feature: name => name === LEAN_RPG_FEATURE, state }, rolled: false });
    assert.equal(fightIsOpen(stateOf(3)), true);
    assert.equal(isQuiet(hint(stateOf(3)), stateOf(3)), false, 'a fight stands: the Combat rules text stays');
    assert.equal(isQuiet(hint(stateOf(0)), stateOf(0)), true, 'no group stands: a quiet reply');
});
