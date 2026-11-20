import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeGroups } from '../../../../modules/rpg/board/precheck-parts/v1-sizing.js';
import { winXp } from '../../../../modules/rpg/combat/rewards.js';

// Owner, 20 Nov: "the prompt was for 12 rats, it only gave 6 … group bonus missing".
test('a crowd of mobs past a slot splits into groups of six, each named apart, as far as the slots go', () => {
  const twelve = sizeGroups([{ name: 'aggressive rats', count: 12, level: 1, tier: 'mob' }]);
  assert.deepEqual(twelve.map(g => [g.name, g.count]), [['aggressive rats', 6], ['aggressive rats (2)', 6]]);
  const nine = sizeGroups([{ name: 'minions', count: 9, level: 2, tier: 'minion' }]);
  assert.deepEqual(nine.map(g => [g.name, g.count]), [['minions', 6], ['minions (2)', 3]]);
  const huge = sizeGroups([{ name: 'rats', count: 99, level: 1, tier: 'mob' }]);
  assert.equal(huge.length, 6, 'never more groups than the Foes block has slots');
});

test('the standard and elite size rules are unchanged', () => {
  assert.deepEqual(sizeGroups([{ name: 'bandits', count: 7, level: 3, tier: 'standard' }]).map(g => g.count), [4]);
  assert.deepEqual(sizeGroups([{ name: 'knights', count: 5, level: 9, tier: 'elite' }]).map(g => g.count), [3]);
});

test('XP: mobs and minions pay their own tier factor, so a crowd is worth the fight', () => {
  assert.equal(winXp([{ slot: 1, count: 1, level: 1, tier: 'mob' }], 1), 7);
  assert.equal(winXp([{ slot: 1, count: 6, level: 1, tier: 'mob' }], 1), 12);
  assert.equal(winXp([{ slot: 1, count: 6, level: 1, tier: 'mob' }, { slot: 2, count: 6, level: 1, tier: 'mob' }], 1), 25);
  assert.equal(winXp([{ slot: 1, count: 1, level: 1, tier: 'standard' }], 1), 15, 'a standard foe as before');
});
