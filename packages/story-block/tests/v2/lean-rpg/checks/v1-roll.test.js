import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBonus, checkOutcome, masteryOf } from '../../../../src/v2/lean-rpg/checks/v1-roll.js';

const who = (stat, level) => ({ level, stats: { str: stat, dex: stat, int: stat, wis: stat } });
const utility = rank => ({ name: 'Lore', stat: 'int', rank, type: 'utility' });

test('the v1 formula table: stat÷2 rounds down, level÷4 rounds down', () => {
    const rows = [[5, 1, 2], [6, 1, 3], [7, 3, 3], [7, 4, 4], [10, 7, 6], [10, 8, 7], [29, 99, 14 + 24], [30, 99, 15 + 24], [1, 1, 0]];
    for (const [stat, level, want] of rows) assert.equal(checkBonus(who(stat, level), null, 'str'), want, `stat ${stat}, level ${level}`);
});

test('a utility skill adds half its mastery, rounded up: Novice 1 → 1 … Legend 7 → 4', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(masteryOf), [1, 2, 3, 4, 5, 6, 7]);
    const base = checkBonus(who(10, 8), null, 'int');
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(rank => checkBonus(who(10, 8), utility(rank), null) - base), [1, 1, 2, 2, 3, 3, 4]);
});

test('only a utility skill adds mastery; the skill\'s own stat leads, WIS counts, a missing stat is the start 5', () => {
    assert.equal(checkBonus(who(10, 4), { name: 'Slash', stat: 'str', rank: 6, type: 'attack' }, null), 6);
    assert.equal(checkBonus(who(10, 4), { name: 'Slash', stat: 'str', rank: 6 }, null), 6);
    assert.equal(checkBonus({ level: 1, stats: { wis: 20 } }, { name: 'Sense', stat: 'wis', rank: 0, type: 'utility' }, null), 11);
    assert.equal(checkBonus({ level: 1, stats: {} }, null, 'dex'), 2, 'no stat: 5 ÷ 2');
    assert.equal(checkBonus({ stats: { str: 12 } }, null, 'str'), 6, 'no level: level 1');
});

test('the outcome: a tie succeeds, a natural 1 fails, a natural 20 is decisive only when it succeeds, a lead of 8 is decisive, no cost', () => {
    assert.deepEqual(checkOutcome(10, 5, 15), { outcome: 'success', decisive: false });
    assert.deepEqual(checkOutcome(10, 4, 15), { outcome: 'fail', decisive: false });
    assert.deepEqual(checkOutcome(1, 30, 10), { outcome: 'fail', decisive: false });
    assert.deepEqual(checkOutcome(20, 0, 15), { outcome: 'success', decisive: true });
    assert.deepEqual(checkOutcome(20, 0, 25), { outcome: 'fail', decisive: false });
    assert.deepEqual(checkOutcome(12, 6, 10), { outcome: 'success', decisive: true });
    assert.deepEqual(checkOutcome(11, 6, 10), { outcome: 'success', decisive: false });
});
