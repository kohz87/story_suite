import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangesOf, rpgReplyLines } from '../../../../modules/rpg/view/changes-lines.js';
import { mergeRpgLines, changesSummary, replyCardLines } from '../../../../ui/legacy/screens/changes-card.js';
import { RESOLVE } from '../../../../modules/rpg/index.js';
import { characterDefinition, fakeState, roleOf, skillsDefinition } from './helpers.js';

const skillsShow = { tab: true, card: false, tabName: 'Skills', icon: 'ph-star' };
const world = ({ level = 2, xp = 40, rank = 1, ren = 1, points = 0 } = {}) => fakeState([
    { definition: characterDefinition('wessel', 'Wessel'), fields: { level, xp, points } },
    { definition: characterDefinition('ren', 'Ren'), fields: { level: ren } },
    { definition: skillsDefinition('wessel-skills', 'Wessel', skillsShow), fields: { skill1: 'Iron Breath', rank1: rank } },
]);
const record = (...receipts) => ({ receipts });
const rolled = result => ({ id: 'r1', type: RESOLVE, data: { v2: { result } } });

test('the rank rise reads "Iron Breath: Adept → Expert"; a character who did not rise says nothing', () => {
    const lines = rpgReplyLines({ state: world({ rank: 2 }), before: world({ rank: 1 }), record: record(), roleOf });
    assert.deepEqual(lines.map(line => line.text), ['Iron Breath: Adept → Expert']);
    assert.equal(lines[0].note, 'practice reached 100');
    assert.deepEqual(rpgReplyLines({ state: world({ level: 2 }), before: world({ level: 2 }), record: record(), roleOf }), []);
    assert.deepEqual(rpgReplyLines({ state: world({ rank: 0 }), before: world({ rank: 1 }), record: record(), roleOf }), [], 'a fall (a swipe\'s other state) is no rise');
});
