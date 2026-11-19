import test from 'node:test';
import assert from 'node:assert/strict';
import { V1 } from '../../../modules/rpg/combat/numbers.js';
import { RPG_STRINGS, fill } from '../../../modules/rpg/strings.js';

test('the Skills hint says which bar a skill uses, from the rule numbers', () => {
  const text = fill(RPG_STRINGS.wizard.barsHint, { magic: V1.skill.magicStats.map(s => s.toUpperCase()).join(' or '), stance: V1.cost.stance });
  assert.match(text, /INT or WIS uses Mana \(MP\)/);
  assert.match(text, /Stamina \(SP\)/);
  assert.match(text, /costs 1 each exchange/);
});
