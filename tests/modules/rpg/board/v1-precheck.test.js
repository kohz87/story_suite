// The pre-check on a Combat Rules v1 sheet: a group's tier (when the answer names one; else standard) is kept and the fight is held to the size rule (an even fight is at most 4 standard foes, a group of elites at most 3).
// The prompt on a v1 sheet adds the owner-approved tier and size-rule lines (pinned byte for byte below); a sheet that is not v1 gets the old prompt and vets exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { precheckPrompt, vetGroups } from '../../../../modules/rpg/board/precheck.js';
import { sizeGroups } from '../../../../modules/rpg/board/precheck-parts/v1-sizing.js';

const sheet = { characters: [{ who: 'Astra', level: 5, v1: true }], foes: [] };
const message = 'I attack the guards, the hounds and the captain', previous = '';
const answer = [{ name: 'guards', count: 6, level: 4, tier: 'standard' }, { name: 'hounds', count: 5, level: 3, tier: 'minion' }, { name: 'captain', count: 4, level: 9, tier: 'ELITE' }];

test('v1: tiers are kept, standard foes cap at 4 in all, elites at 3 a group, minions keep their count', () => {
    const got = vetGroups(answer, { message, previous, sheet, v1: true });
    assert.deepEqual(got.map(({ name, count, tier }) => [name, count, tier]), [['guards', 4, 'standard'], ['hounds', 5, 'minion'], ['captain', 3, 'elite']]);
});

test('v1: the standard room is shared by the groups in order; a group left with no room is dropped; an unknown tier is standard', () => {
    assert.deepEqual(sizeGroups([{ name: 'a', count: 3 }, { name: 'b', count: 3, tier: 'nonsense' }, { name: 'c', count: 2, tier: 'standard' }]).map(({ name, count }) => [name, count]), [['a', 3], ['b', 1]]);
    assert.deepEqual(sizeGroups([{ name: 'a', count: 9, tier: 'boss' }, { name: 'b', count: 9, tier: 'mob' }]).map(({ count }) => count), [3, 9]);
});

test('without v1 the answer is vetted exactly as before (no tier, no size rule)', () => {
    const got = vetGroups(answer, { message, previous, sheet });
    assert.deepEqual(got.map(({ name, count }) => [name, count]), [['guards', 6], ['hounds', 5], ['captain', 4]]);
    assert.equal(got.some(group => 'tier' in group), false);
});

const TIER_LINE = '- tier is required, one of: mob, minion, standard, elite, boss, apex. A rat or a beggar is a mob or a minion, a trained guard or a bandit is standard, a veteran, officer or champion is elite, a named leader is a boss, a dragon or a titan is an apex. When unsure, standard.';
const SIZE_LINE = '- An even fight is at most 4 standard foes; a group of elites is at most 3. Give a bigger crowd as several groups, or leave the extra foes out.';
const LEVEL_LINE_START = '- level is required (a whole number)';

test('the v1 pre-check prompt carries the approved tier and size lines right after the level rule, and the tiered reply shape; the old prompt has neither', () => {
    const lines = precheckPrompt({ message, previous, sheet, v1: true }).split('\n');
    const at = lines.findIndex(line => line.startsWith(LEVEL_LINE_START));
    assert.equal(lines[at + 1], TIER_LINE);
    assert.equal(lines[at + 2], SIZE_LINE);
    assert.equal(lines.at(-1), '{"groups":[{"name":"...","count":1,"level":2,"tier":"standard"}]}');
    const old = precheckPrompt({ message, previous, sheet });
    assert.equal(/tier/.test(old), false);
    assert.equal(old.split('\n').at(-1), '{"groups":[{"name":"...","count":1,"level":2}]}');
    assert.deepEqual(lines.filter(line => line !== TIER_LINE && line !== SIZE_LINE && !line.startsWith('{"groups":[{"name":"...","count":1,"level":2,')), old.split('\n').filter(line => !line.startsWith('{"groups":[{"name":"...","count":1,"level":2}')));
});

test('runPrecheck on a v1 sheet asks the v1 prompt and returns sized, tiered groups; on an old sheet the old prompt and untiered groups', async () => {
    const { runPrecheck } = await import('../../../../modules/rpg/board/precheck-run.js');
    const run = async character => {
        const seen = [];
        const groups = await runPrecheck({ callModel: async prompt => { seen.push(prompt); return JSON.stringify({ groups: answer }); }, message, sheet: { characters: [character], foes: [] } });
        return { prompt: seen[0], groups };
    };
    const v1 = await run({ who: 'Astra', level: 5, v1: true }), old = await run({ who: 'Astra', level: 5 });
    assert.match(v1.prompt, /tier is required/u);
    assert.equal(old.prompt, precheckPrompt({ message, sheet: { characters: [{ who: 'Astra', level: 5 }], foes: [] } }), 'an old sheet gets the old prompt');
    assert.doesNotMatch(old.prompt, /tier/u);
    assert.deepEqual(v1.groups.map(group => [group.count, group.tier]), [[4, 'standard'], [5, 'minion'], [3, 'elite']]);
    assert.equal(old.groups.some(group => 'tier' in group), false);
});
