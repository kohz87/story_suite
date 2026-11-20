// The Combat Rules v1 fight XP of 20 Nov pays 15 for EACH foe (owner: "it should be 15 each"); a fight whose setup has no `xpRule: 'each'` mark keeps the per-group rule it was paid with (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { foeGroupsOf, winXp } from '../../../../modules/rpg/combat/rewards.js';
import { paidOf } from '../../../../modules/rpg/board/v1-award.js';
import { V1 } from '../../../../modules/rpg/board/v1-kind.js';

const one = (count, level, tier) => [{ slot: 1, count, level, tier }];
const each = (groups, level) => winXp(groups, level, 'each');

test('each-foe rule: 15 x band x gap per cent x tier for every foe, added, rounded down, 1..100', () => {
  assert.equal(each([{ slot: 1, count: 2, level: 2, tier: 'standard' }], 1), 33, 'Lv1 vs two Lv2 standard');
  assert.equal(each(one(1, 1, 'standard'), 1), 15);
  assert.equal(each(one(6, 1, 'mob'), 1), 45);
  assert.equal(each(one(12, 1, 'mob'), 1), 90);
  assert.equal(each(one(3, 1, 'elite'), 1), 67);
  assert.equal(each(one(9, 50, 'apex'), 1), 100, 'held to 100');
  assert.equal(each(one(1, 5, 'standard'), 15), 0, 'a foe 10 levels below pays nothing');
});

test('each-foe rule does not depend on how a crowd was split into slots', () => {
  const rats = (slot, count, label) => Array.from({ length: count }, (_, n) => ({ id: `${slot}.${n + 1}`, label: `${label} ${n + 1}`, level: 1, tier: 'mob' }));
  assert.equal(each(foeGroupsOf({ foes: [...rats(1, 6, 'rats'), ...rats(2, 6, 'rats (2)')] }), 1), 90);
  assert.equal(each(foeGroupsOf({ foes: rats(1, 12, 'rats') }), 1), 90);
});

test('the old per-group rule is kept for a record without the mark', () => {
  assert.equal(winXp([{ slot: 1, count: 2, level: 2, tier: 'standard' }], 1), 18);
  assert.equal(winXp([{ slot: 1, count: 2, level: 2, tier: 'standard' }], 1, ''), 18);
  assert.equal(winXp(one(6, 90, 'apex'), 1), 60);
});

test('paidOf follows the setup\'s mark: marked setups pay 15 each, unmarked ones pay per group; a new fight opens marked', () => {
  const foes = [{ id: '1.1', level: 2, tier: 'standard' }, { id: '1.2', level: 2, tier: 'standard' }];
  const record = { result: 'win', foes, party: [{ id: 'astra', label: 'Astra', level: 1, skills: [] }], rounds: [] };
  const args = { modules: { astra: 'm' }, alive: new Set(['astra']) };
  assert.equal(paidOf(record, { rate: 100, practice: 3, xpRule: 'each' }, args).xp[0].xp, 33);
  assert.equal(paidOf(record, { rate: 100, practice: 3 }, args).xp[0].xp, 18, 'a fight opened before the mark');
  const next = V1.next({ id: 'x', v1: 1, xpRule: 'each', offset: 0 }, { exchanges: 2, order: {}, rotation: 0, foes: [] });
  assert.equal(next.xpRule, 'each', 'the mark carries to the next reply\'s setup');
});
