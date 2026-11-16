// The pre-check on a Combat Rules v1 sheet: each group names its tier, the fight is held to the size rule (an even fight is at most 4 standard foes, a group of elites at most 3), and the prompt says so.
// A sheet that is not v1 is untouched: the prompt and the vetted groups are byte-identical to what they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import { precheckPrompt, vetGroups } from '../../../../src/v2/lean-rpg/board/precheck.js';
import { sizeGroups } from '../../../../src/v2/lean-rpg/board/precheck-parts/v1-sizing.js';

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

test('the v1 prompt names the tier and the size rule; the old prompt does not', () => {
    const old = precheckPrompt({ message, previous, sheet }), v1 = precheckPrompt({ message, previous, sheet, v1: true });
    assert.equal(/tier/.test(old), false);
    assert.match(v1, /- tier is required, one of: mob, minion, standard, elite, boss, apex\./);
    assert.match(v1, /An even fight is at most 4 standard foes; a group of elites is at most 3\./);
    assert.match(v1, /"tier":"standard"/);
    assert.equal(v1.replace(/\n- tier is required[^\n]*\n- An even fight[^\n]*/, '').replace(',"tier":"standard"', ''), old, 'the v1 prompt is the old one plus exactly those lines');
});

test('runPrecheck on a v1 sheet asks the v1 prompt and returns sized, tiered groups; on an old sheet the old prompt and untiered groups', async () => {
    const { runPrecheck } = await import('../../../../src/v2/lean-rpg/board/precheck-run.js');
    const run = async character => {
        const seen = [];
        const groups = await runPrecheck({ callModel: async prompt => { seen.push(prompt); return JSON.stringify({ groups: answer }); }, message, sheet: { characters: [character], foes: [] } });
        return { prompt: seen[0], groups };
    };
    const v1 = await run({ who: 'Astra', level: 5, v1: true }), old = await run({ who: 'Astra', level: 5 });
    assert.match(v1.prompt, /tier is required/);
    assert.deepEqual(v1.groups.map(group => [group.count, group.tier]), [[4, 'standard'], [5, 'minion'], [3, 'elite']]);
    assert.equal(/tier/.test(old.prompt), false);
    assert.equal(old.groups.some(group => 'tier' in group), false);
});
