// A pack's skill sets in the New character wizard: the pack's sp or mp reaches the wizard as the stamina or mana it still reads, and a v1 type other than attack is kept on the draft's skill.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skillSetsOf } from '../../../../modules/rpg/view/wizard-data-parts/sets.js';
import { withSet, readDraft } from '../../../../modules/rpg/view/wizard-data.js';

const packSet = { id: 'pack.ers/recruit', slug: 'recruit', pack: 'ers', name: 'Recruit', about: '', skills: [
    { name: 'Spear', about: 'A spear.', stat: 'str', uses: 'sp', type: 'attack' },
    { name: 'Ward-reading', about: 'Reads wards.', stat: 'int', uses: 'mp', type: 'utility' },
    { name: 'Breach drill', about: 'Falls back in order.', stat: 'agi', uses: 'sp', type: 'movement' },
    { name: 'Healing hand', about: 'Mends.', stat: 'wis', uses: 'mp', type: 'heal' },
] };

test('skillSetsOf hands the wizard a pack set with stamina or mana for sp or mp, and the types as they are', () => {
    const [ours] = skillSetsOf({ packSets: [packSet], packNames: { ers: 'Ersveil' } }).filter(set => !set.builtIn);
    assert.deepEqual(ours.skills.map(skill => [skill.name, skill.uses, skill.type]), [['Spear', 'stamina', 'attack'], ['Ward-reading', 'mana', 'utility'], ['Breach drill', 'stamina', 'movement'], ['Healing hand', 'mana', 'heal']]);
    assert.equal(packSet.skills[0].uses, 'sp', 'the pack\'s own record is not changed');
});

test('a set put into the draft keeps each skill\'s v1 type (attack is the default and is not written), its stat and its pool', () => {
    const [ours] = skillSetsOf({ packSets: [packSet] }).filter(set => !set.builtIn);
    const draft = withSet(readDraft({ name: 'Mara' }), ours);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.stat, skill.uses, skill.type]), [
        ['Spear', 'str', 'stamina', undefined], ['Ward-reading', 'int', 'mana', 'utility'], ['Breach drill', 'agi', 'stamina', 'movement'], ['Healing hand', 'wis', 'mana', 'heal']]);
    assert.deepEqual(readDraft(draft).skills.map(skill => skill.type), [undefined, 'utility', 'movement', 'heal'], 'a draft read again keeps them');
});
