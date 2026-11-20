// The Combat Rules v1 fight XP RPG.md states: a Lv 2 member against four Lv 2 Mob foes and two Lv 1 Standard foes gets 25 (not the earlier marked Character's 15-per-foe, cap 100).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { winXp } from '../../../../modules/rpg/combat/rewards.js';

test('winXp gives the RPG.md example, and RPG.md states it', () => {
  assert.equal(winXp([{ slot: 1, count: 4, level: 2, tier: 'mob' }, { slot: 2, count: 2, level: 1, tier: 'standard' }], 2), 25);
  const docs = readFileSync(new URL('../../../../docs/v2/RPG.md', import.meta.url), 'utf8');
  assert.match(docs, /Combat Rules v1 fight XP \(every new chat; what is built\)/);
  assert.match(docs, /Lv 2 member against four Lv 2 Mob foes and two Lv 1 Standard foes gets 25/);
});
