// A Combat Rules v1 Character on the Party tab: HP, MP and SP as numbers with their largest values, the seven stats with WIS (1 to 30), no growth line of blocks and luck, the pencil's choices
// counted in whole numbers (written to hp, mp, sp), and the Spend points sheet's radar and line running to 30 and saying HP, MP and SP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { createPartyWidget } from '../../../../modules/rpg/view/party.js';
import { readParty, barOptions } from '../../../../modules/rpg/view/party-data.js';
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../modules/rpg/templates-parts/v1-skills.js';
import { fakeState, roleOf } from './helpers.js';

const fields = { who: 'Astra', hp: 6, 'hp-max': 13, mp: 9, 'mp-max': 11, sp: 4, 'sp-max': 12, str: 14, vit: 12, agi: 10, dex: 9, int: 8, wis: 17, cha: 5, points: 2, level: 5, xp: 30, cap: 99 };
const hero = () => ({ definition: { ...structuredClone(characterV1), slug: 'wessel' }, fields });
const state = () => fakeState([hero(), { definition: { ...structuredClone(skillsV1), slug: 'wessel-skills' }, fields: { who: 'Astra', skill1: 'Mend', about1: 'Closes a wound', stat1: 'wis', type1: 'heal', practice1: 250, rank1: 2 } }]);

test('readParty reads a v1 Character: numeric bars, WIS and no LUK, the skill with its type and rank, no growth line', () => {
    const [astra] = readParty(state(), { own: 'Astra', roleOf });
    assert.equal(astra.v1, true);
    assert.deepEqual(['health', 'mana', 'stamina'].map(key => [astra.bars[key].value, astra.bars[key].max, astra.bars[key].text, astra.bars[key].field]),
        [[6, 13, '6 of 13', 'hp'], [9, 11, '9 of 11', 'mp'], [4, 12, '4 of 12', 'sp']]);
    assert.deepEqual(astra.stats.map(stat => [stat.key, stat.value, stat.max]), [['str', 14, 30], ['vit', 12, 30], ['agi', 10, 30], ['dex', 9, 30], ['int', 8, 30], ['wis', 17, 30], ['cha', 5, 30]]);
    assert.equal(astra.growth, null);
    assert.deepEqual([astra.skills[0].name, astra.skills[0].stat, astra.skills[0].type, astra.skills[0].rank, astra.skills[0].practice], ['Mend', 'wis', 'combat', 2, 250]);
    assert.deepEqual(barOptions('health', astra.definition.state.hp, astra.bars.health).map(option => option.label).slice(0, 3), ['0 of 13', '1 of 13', '2 of 13']);
});

test('the Party card draws a v1 Character: three bars written to hp, mp and sp, and the stats with WIS', () => {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const commands = [];
    createPartyWidget({ headState: state, readerName: () => 'Astra', roleOf, openWizard: null }).render(el, {}, { command: async (...args) => { commands.push(args); return { ok: true }; } });
    const card = el.querySelector('.rpg-card[data-character="Astra"]');
    assert.ok(card, 'the card is drawn');
    assert.deepEqual(['health', 'mana', 'stamina'].map(key => Boolean(card.querySelector(`[data-bar="${key}"]`))), [true, true, true]);
    assert.match(card.textContent, /6 of 13/);
    assert.match(card.textContent, /WIS/);
    assert.doesNotMatch(card.textContent, /LUK|Edge|blocks/);
    assert.ok(card.querySelector('[data-bar-edit="health"]'), 'a bar can be edited');
});

test('the Spend points sheet of a v1 Character: stats to 30 with WIS, the line says HP, MP and SP for the stats being set', async () => {
    const { renderDistribute } = await import('../../../../modules/rpg/view/distribute.js');
    const doc = setupDom(), host = doc.createElement('div');
    doc.body.appendChild(host);
    const [astra] = readParty(state(), { own: 'Astra', roleOf });
    renderDistribute(host, { character: astra, api: {}, doc, rules: null });
    const root = host.querySelector('.rpg-sheet');
    assert.ok(root.querySelector('.rpg-stat-step[data-stat="wis"]'), 'a WIS stepper');
    assert.equal(root.querySelector('.rpg-stat-step[data-stat="luk"]'), null, 'no LUK stepper');
    const line = root.querySelector('[data-rpg="growth"]');
    assert.ok(line, 'the line under the steppers is there for a v1 sheet even with no earlier rules set');
    assert.match(line.textContent, /^HP 12 · MP 15 · SP 15 at Lv 5$/, 'the sizes the stats and level give (combat/bars.js)');
    assert.equal(root.querySelector('.rpg-stat-step[data-stat="wis"] .ss-w-stepper-inc').disabled, false);
});

test('the Skills screen of a v1 Character: seven ranks on the bar, the stat and the rank, and no line that explains the earlier roll', async () => {
    const { renderSkills } = await import('../../../../modules/rpg/view/skills.js');
    const doc = setupDom(), host = doc.createElement('div');
    doc.body.appendChild(host);
    const [astra] = readParty(state(), { own: 'Astra', roleOf });
    renderSkills(host, { character: astra, doc, rules: () => ({}) });
    const row = host.querySelector('.rpg-skill[data-slot="1"]');
    assert.ok(row, 'the Mend row');
    assert.equal(row.querySelector('.rpg-skill-roll').textContent, 'Rolls with WIS · Adept');
    assert.equal(row.querySelector('.rpg-skill-uses').textContent, 'WIS');
    assert.match(row.textContent, /Adept · 50 \/ 100 to Expert/, 'practice 250 is half way from Adept (200) to Expert (300)');
    assert.doesNotMatch(row.textContent, /d20|Stamina|Mana/);
});
