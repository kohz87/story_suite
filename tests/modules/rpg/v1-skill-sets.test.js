// The built-in skill sets carry Combat Rules v1 types (a set holds at most one stance skill), the wizard keeps them, and the pre-check's raw tier answer is kept in the opening's setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_SETS } from '../../../modules/rpg/templates.js';
import { SKILL_TYPE_NAMES } from '../../../modules/rpg/templates-combat.js';
import { STANCE_TYPES } from '../../../core/runtime/skill-slots.js';
import { withSet } from '../../../modules/rpg/view/wizard-data.js';
import { vetGroups } from '../../../modules/rpg/board/precheck.js';
import { openingSetup } from '../../../modules/rpg/board/opening.js';
import { openingV1 } from '../../../modules/rpg/board/v1-opening.js';
import { preludeDice } from '../../../core/interaction/dice.js';
import { v1Host } from './board/v1.helpers.js';

test('every built-in skill set is valid under the v1 rules: known types, at most one stance skill', () => {
    for (const set of SKILL_SETS) {
        for (const skill of set.skills) assert.ok(SKILL_TYPE_NAMES.includes(skill.type), `${set.name} / ${skill.name}: ${skill.type} is a known type`);
        assert.ok(set.skills.filter(skill => STANCE_TYPES.includes(skill.type)).length <= 1, `${set.name} holds at most one stance skill`);
    }
});

test('the Guild fighter set is not three attacks, and the wizard keeps each skill\'s type (attack stays the unwritten default)', () => {
    const fighter = SKILL_SETS.find(set => set.id === 'guild-fighter');
    assert.deepEqual(fighter.skills.map(skill => skill.type), ['attack', 'utility', 'defence']);
    const draft = withSet({ level: 1, skills: [] }, fighter);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.type]), [['Short blade', undefined], ['Iron Breath', 'utility'], ['Shield work', 'defence']]);
    for (const set of SKILL_SETS) {
        const made = withSet({ level: 1, skills: [] }, set);
        assert.deepEqual(made.skills.map(skill => skill.type ?? 'attack'), set.skills.map(skill => skill.type), `${set.name}: the draft holds the set's types`);
    }
});

test('the pre-check keeps its raw tier answer next to the tier; an absent or unknown one is told apart from a plain standard', () => {
    const sheet = { characters: [{ who: 'Astra', level: 5, v1: true }], foes: [] };
    const message = 'I attack the guards, the hounds and the captain';
    const got = vetGroups([{ name: 'guards', count: 1, level: 4, tier: 'standard' }, { name: 'hounds', count: 1, level: 3 }, { name: 'captain', count: 1, level: 9, tier: ' Legendary ' }], { message, sheet, v1: true });
    assert.deepEqual(got.map(({ tier, tierSaid }) => [tier, tierSaid]), [['standard', 'standard'], ['standard', null], ['standard', 'Legendary']]);
    assert.equal(vetGroups([{ name: 'guards', count: 1, level: 4, tier: 'elite' }], { message, sheet }).some(group => 'tierSaid' in group), false, 'an earlier sheet records nothing');
});

test('the raw tier answer is in the opening setup, replays equal, and is neither in the record nor changes it', async () => {
    const host = (await v1Host({ count: 0 })).host;
    try {
        const groups = [{ name: 'Wolves', count: 2, level: 6, tier: 'standard', tierSaid: null }, { name: 'Brute', count: 1, level: 9, tier: 'elite', tierSaid: 'elite' }];
        const plain = groups.map(({ tierSaid: _said, ...rest }) => rest);
        const made = openingSetup({ groups, key: 'k1', rules: {}, anchor: 'a', practice: 3 });
        assert.deepEqual(made.setup.open.map(group => group.tierSaid), [null, 'elite'], 'the setup records it');
        const play = setup => openingV1(host.head(), setup, preludeDice(5));
        const first = play(made.setup), again = play(structuredClone(made.setup)), without = play(openingSetup({ groups: plain, key: 'k1', rules: {}, anchor: 'a', practice: 3 }).setup);
        assert.deepEqual(again, first, 'the same setup replays to the same record');
        assert.deepEqual(without, first, 'the diagnostic changes nothing the record or the block gets');
        assert.equal(JSON.stringify(first).includes('tierSaid'), false, 'it is not in the result or the changes');
    } finally { host.close(); }
});

test('choosing a second set replaces the first set\'s utility skills; a utility skill the reader made stays', () => {
    const [fighter, scout] = SKILL_SETS;
    const own = { name: 'Cooking', about: 'Camp food.', stat: 'int', uses: 'stamina', start: 0, type: 'utility' };
    const first = withSet({ level: 1, skills: [own] }, fighter), second = withSet(first, scout);
    assert.deepEqual(second.skills.map(skill => skill.name), ['Cooking', 'Rope work', 'Swimming', 'Tracking']);
    assert.equal(second.skills.length, 1 + scout.skills.length);
});
