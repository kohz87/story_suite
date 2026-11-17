// Ersveil's v1 skill types as the owner called them (17 Nov): Binding Rune is support while it is Ysmeth's only stance skill, Mother's Hand is utility because its text does not mend,
// Iron Breath is utility, and every Silver tongue skill is utility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_SETS } from '../../modules/rpg/templates-parts/skill-sets.js';

const pack = JSON.parse(readFileSync(new URL('../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const skillsOf = id => pack.content.cast.find(person => person.id === id).skills;
const STANCES = ['defence', 'evasion', 'movement', 'support'];

test('Ysmeth: Binding Rune is support, and it is his only stance skill', () => {
    const skills = skillsOf('ysmeth');
    assert.equal(skills.find(skill => skill.name === 'Binding Rune').type, 'support');
    assert.equal(skills.filter(skill => STANCES.includes(skill.type)).length, 1);
});

test('Hush: Mother\'s Hand does not mend, so it is utility (a mending text would make it a heal on mana)', () => {
    const hand = skillsOf('hush').find(skill => skill.name === 'Mother\'s Hand');
    assert.doesNotMatch(hand.about, /\b(mend|mends|heal|heals|closes a wound)\b/i);
    assert.equal(hand.type, 'utility');
});

test('Iron Breath and every Silver tongue skill are utility', () => {
    const sets = Object.fromEntries(SKILL_SETS.map(set => [set.id, set.skills]));
    assert.equal(sets['guild-fighter'].find(skill => skill.name === 'Iron Breath').type, 'utility');
    assert.deepEqual(sets['silver-tongue'].map(skill => skill.type), ['utility', 'utility', 'utility']);
});
