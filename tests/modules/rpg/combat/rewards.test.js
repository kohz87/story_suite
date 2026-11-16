// The numbers a v1 fight pays, from its record alone: tier XP, the skills used, the legend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foeGroupsOf, legendOf, usesOfV1, winXp } from '../../../../modules/rpg/combat/rewards.js';

const foe = (id, level, tier) => ({ id, level, tier });

test('winXp: (15 + 2 per extra foe) x level band x gap per cent x tier factor, rounded down, held to 1..60', () => {
    const one = tier => winXp([{ slot: 1, count: 1, level: 5, tier }], 5);
    assert.deepEqual(['mob', 'minion', 'standard', 'elite', 'boss', 'apex'].map(one), [3, 7, 15, 22, 30, 45]);
    assert.equal(winXp([{ slot: 1, count: 4, level: 5, tier: 'standard' }], 5), 21, '15 + 2 x 3');
    assert.equal(winXp([{ slot: 1, count: 1, level: 5, tier: 'standard' }], 15), 0, 'a foe 10 levels below pays nothing');
    assert.equal(winXp([{ slot: 1, count: 6, level: 90, tier: 'apex' }], 1), 60, 'capped at 60');
    assert.equal(winXp([{ slot: 1, count: 1, level: 5, tier: 'standard' }, { slot: 2, count: 1, level: 5, tier: 'elite' }], 5), 37, 'two groups sum (15 + 22.5) before the rounding');
});

test('foeGroupsOf groups the foe rows by slot; an unknown tier reads as standard', () => {
    const record = { foes: [foe('1.1', 5, 'elite'), foe('1.2', 5, 'elite'), foe('3.1', 9, 'wat')] };
    assert.deepEqual(foeGroupsOf(record), [{ slot: 1, count: 2, level: 5, tier: 'elite' }, { slot: 3, count: 1, level: 9, tier: 'standard' }]);
});

test('legendOf: a win against a group 10 levels above the party\'s highest', () => {
    const party = [{ level: 5 }, { level: 8 }], groups = level => [{ slot: 1, count: 1, level, tier: 'mob' }];
    assert.equal(legendOf({ result: 'win', party }, groups(18)), true);
    assert.equal(legendOf({ result: 'win', party }, groups(17)), false);
    assert.equal(legendOf({ result: 'loss', party }, groups(40)), false);
});

test('usesOfV1: a skill blow, an area blow once an exchange, a heal and a held stance count one use each; a normal blow counts none', () => {
    const skills = [{ name: 'Cut', type: 'attack', stat: 'str' }, { name: 'Sweep', type: 'area', stat: 'str' }, { name: 'Mend', type: 'heal', stat: 'wis' }, { name: 'Guard', type: 'defence', stat: 'vit' }];
    const attack = (who, how) => ['attack', who, how, 'Rat', 10, 12, 5, 8, 'hit', 3, 4];
    const record = { party: [{ label: 'Astra', skills }, { label: 'Ren', skills: [] }], rounds: [
        [['exchange', 1], ['stance', 'Astra', ['defence']], attack('Astra', 'skill'), attack('Astra', 'normal'), attack('Ren', 'skill')],
        [['exchange', 2], ['stance', 'Astra', []], attack('Astra', 'area'), attack('Astra', 'area'), ['heal', 'Astra', 'Ren', 4, 20], attack('Astra', 'skill')],
    ] };
    assert.deepEqual(usesOfV1(record), [{ who: 'Astra', skill: 'Cut', n: 2 }, { who: 'Astra', skill: 'Guard', n: 1 }, { who: 'Astra', skill: 'Mend', n: 1 }, { who: 'Astra', skill: 'Sweep', n: 1 }]);
});
