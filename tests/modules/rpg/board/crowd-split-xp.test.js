import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeGroups } from '../../../../modules/rpg/board/precheck-parts/v1-sizing.js';
import { foeGroupsOf, winXp } from '../../../../modules/rpg/combat/rewards.js';
import { crowdsOf } from '../../../../modules/rpg/combat/crowds.js';

// Owner, 20 Nov: "the prompt was for 12 rats, it only gave 6 … group bonus missing".
test('a crowd of mobs past a slot splits into groups of six, each named apart, as far as the slots go', () => {
  const twelve = sizeGroups([{ name: 'aggressive rats', count: 12, level: 1, tier: 'mob' }]);
  assert.deepEqual(twelve.map(g => [g.name, g.count]), [['aggressive rats', 6], ['aggressive rats (2)', 6]]);
  const nine = sizeGroups([{ name: 'minions', count: 9, level: 2, tier: 'minion' }]);
  assert.deepEqual(nine.map(g => [g.name, g.count]), [['minions', 6], ['minions (2)', 3]]);
  const huge = sizeGroups([{ name: 'rats', count: 99, level: 1, tier: 'mob' }]);
  assert.equal(huge.length, 6, 'never more groups than the Foes block has slots');
});

test('foes past the size rule come in a tier lower, never dropped (owner, 20 Nov: a sounder of 7 boars came in as 4)', () => {
  assert.deepEqual(sizeGroups([{ name: 'boars', count: 7, level: 2, tier: 'standard' }]).map(g => [g.name, g.count, g.tier]), [['boars', 4, 'standard'], ['boars (lesser)', 3, 'minion']]);
  assert.deepEqual(sizeGroups([{ name: 'knights', count: 5, level: 9, tier: 'elite' }]).map(g => [g.name, g.count, g.tier]), [['knights', 3, 'elite'], ['knights (lesser)', 2, 'standard']]);
  // (a second standard group past the fight's 4 comes in whole as minions under its own name)
  assert.deepEqual(sizeGroups([{ name: 'bandits', count: 4, tier: 'standard' }, { name: 'archers', count: 2, tier: 'standard' }]).map(g => [g.name, g.count, g.tier]), [['bandits', 4, 'standard'], ['archers', 2, 'minion']]);
});

test('XP: mobs and minions pay their own tier factor, so a crowd is worth the fight', () => {
  assert.equal(winXp([{ slot: 1, count: 1, level: 1, tier: 'mob' }], 1), 7);
  assert.equal(winXp([{ slot: 1, count: 6, level: 1, tier: 'mob' }], 1), 12);
  assert.equal(winXp([{ slot: 1, count: 12, level: 1, tier: 'mob' }], 1), 18, 'a crowd of 12: (15 + 2 x 11) x 0.5');
  assert.equal(winXp([{ slot: 1, count: 1, level: 1, tier: 'standard' }], 1), 15, 'a standard foe as before');
});

const rats = (slot, count, name = 'aggressive rats', extra = {}) => Array.from({ length: count }, (_, n) => ({ id: `${slot}.${n + 1}`, label: `${name} ${n + 1}`, level: 1, tier: 'mob', ...extra }));

// Owner, 20 Nov: "each group gives its own xp without consideration of the size of the group?"
test('XP does not depend on how a crowd was split: twelve rats in two slots pay as one crowd of twelve', () => {
  const split = foeGroupsOf({ foes: [...rats(1, 6), ...rats(2, 6, 'aggressive rats (2)')] });
  assert.equal(winXp(split, 1), 18, '(15 + 2 x 11) x 0.5');
  assert.equal(winXp(foeGroupsOf({ foes: rats(1, 12) }), 1), 18, 'the same as one slot of twelve');
  assert.equal(winXp(foeGroupsOf({ foes: [...rats(1, 6), ...rats(2, 3, 'aggressive rats (2)')] }), 1), 15, 'a crowd of nine: (15 + 16) x 0.5 = 15.5, rounded down');
  assert.equal(crowdsOf(split).length, 1);
});

test('different kinds stay separate: another name, tier or level is its own group', () => {
  const foes = [...rats(1, 6), ...rats(2, 6, 'sewer rats'), ...rats(3, 2, 'aggressive rats (3)', { tier: 'minion' }), ...rats(4, 2, 'aggressive rats (4)', { level: 2 })];
  assert.equal(crowdsOf(foeGroupsOf({ foes })).length, 4);
  assert.equal(crowdsOf(foeGroupsOf({ foes: [{ id: '1.1', label: 'rat', level: 1, tier: 'mob' }, { id: '2.1', label: 'rat (2)', level: 1, tier: 'mob' }] })).length, 1, 'single members: the split\'s (n) is stripped');
});

test('a record with no labels merges only neighbours of the same mob or minion tier and level that a split leaves (a full six before)', () => {
  const plain = (slot, count, tier = 'mob', level = 1) => ({ slot, count, level, tier });
  assert.deepEqual(crowdsOf([plain(1, 6), plain(2, 3)]).map(g => g.count), [9]);
  assert.deepEqual(crowdsOf([plain(1, 4), plain(2, 3)]).map(g => g.count), [4, 3], 'not a split: the first group is not full');
  assert.deepEqual(crowdsOf([plain(1, 6), plain(2, 6, 'minion')]).map(g => g.count), [6, 6]);
  assert.deepEqual(crowdsOf([plain(1, 6), plain(3, 2)]).map(g => g.count), [6, 2], 'not next to each other');
  assert.deepEqual(crowdsOf([plain(1, 6, 'standard'), plain(2, 2, 'standard')]).map(g => g.count), [6, 2], 'standard foes never merge');
});
