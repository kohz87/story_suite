// What combat C11 removed stays removed: no Rolls setting, no fight-board feature, no manual grammar, no earlier-block sheet, no fight on a sheet that is not Combat Rules v1.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rpg from '../../../modules/rpg/index.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { fightKind } from '../../../modules/rpg/board/interaction.js';
import { boardReplyGrammar } from '../../../modules/rpg/board/prompt.js';
import { PARTY, sheetDomain } from './helpers.js';
import { v1Blocks } from './board/v1.helpers.js';

test('there is no Rolls setting and no fight-board feature: the defaults and the feature ids do not name them', () => {
    assert.equal(Object.hasOwn(rpg.DEFAULT_SETTINGS, 'rpgRolls'), false);
    assert.equal(Object.hasOwn(rpg, 'ROLLS_SETTING'), false);
    assert.equal(Object.hasOwn(CORE_FEATURE, 'fightBoard'), false);
    assert.equal(Object.values(CORE_FEATURE).includes('story-block.fight-board'), false);
});

test('practice comes from rolled uses while the RPG is on, whatever any setting says', () => {
    assert.equal(rpg.practiceFromRollsOnly(true, { rpgRolls: 'off' }), true);
    assert.equal(rpg.practiceFromRollsOnly(false, {}), false);
});

test('the reply grammar has no manual mode: a manual request still offers only the clears, and an ended fight the set-slot and clears', () => {
    const state = sheetDomain({ foes: { role: 'foes', definition: v1Blocks().foes.definition, fields: v1Blocks().foes.fields } });
    const wrap = { domains: { dataModules: state } };
    const quiet = boardReplyGrammar(wrap, { fight: true, manual: true }).join('\n');
    assert.doesNotMatch(quiet, /hurt-N|kind: hurt/u, 'no foe is hurt by the narrator');
    assert.match(quiet, /clear-/u);
});

test('a block that is not a Combat Rules v1 one is left out of the sheet with a plain sentence, and no fight opens on it', () => {
    const state = { domains: { dataModules: sheetDomain(PARTY()) } };
    const sheet = rpg.readSheet(state);
    assert.deepEqual([sheet.characters.length, sheet.foes.length], [0, 0]);
    assert.ok(sheet.problems.some(text => /not a Combat Rules v1 Character/u.test(text)), sheet.problems.join(' | '));
    const opened = fightKind.open({ domains: { dataModules: sheetDomain(PARTY()), inventory: {}, scene: {} } }, { anchor: 'a', seed: 1 });
    assert.equal(opened.error, 'There is no fight to open.');
    assert.equal(opened.setup, undefined);
});
