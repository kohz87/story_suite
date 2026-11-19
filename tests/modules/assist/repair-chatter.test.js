import test from 'node:test';
import assert from 'node:assert/strict';
import { REPAIR_KINDS, allowedKinds } from '../../../modules/assist/index.js';
import { refusedWhy } from '../../../modules/assist/safety-parts/wall.js';

// A reply that came with no change block (owner, 19 Nov): the repair also gives back its inner chatter and choices; they change nothing in the game.
test('a repair may write inner chatter and choices', () => {
  const allow = allowedKinds(REPAIR_KINDS);
  assert.equal(allow.has('~ chatter'), true);
  assert.equal(allow.has('? choice'), true);
  assert.equal(refusedWhy({ op: '~', kind: 'chatter', name: 'Pella' }, allow, { repair: true }), '');
  assert.equal(refusedWhy({ op: '?', kind: 'choice', name: 'Ask Pella about a healer' }, allow, { repair: true }), '');
});

test('everything else with ? stays refused, and a choice outside a repair or read late too', () => {
  const allow = allowedKinds(REPAIR_KINDS);
  assert.match(refusedWhy({ op: '?', kind: 'roll', name: 'Astra' }, allow, { repair: true }), /never asks for rolls/);
  assert.notEqual(refusedWhy({ op: '?', kind: 'loot', name: 'pelts' }, allow, { repair: true }), '', 'loot is refused (by the coin, loot and XP rule first)');
  assert.match(refusedWhy({ op: '?', kind: 'choice', name: 'x' }, allow, { repair: false }), /never asks for rolls/);
  assert.match(refusedWhy({ op: '?', kind: 'choice', name: 'x' }, allow, { repair: true, late: true }), /never asks for rolls/);
});
