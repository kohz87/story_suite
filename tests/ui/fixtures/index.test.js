import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../../ui/fixtures/index.js';

test('fixture("default") returns plain-JSON card, now, chat, and people', () => {
  const vm = fixture();
  assert.equal(vm.card.rpg, true);
  assert.equal(vm.card.scene.time, '9:30 am');
  assert.equal(vm.card.bars.length, 3);
  assert.equal(vm.now.needsYou.length, 2);
  assert.equal(vm.now.here.length, 4);
  assert.equal(vm.now.thisTurn.count, 10);
  assert.equal(vm.chat.inlineRow.changes, 10);
  assert.equal(vm.chat.inlineRow.needsYou.n, 2);
  assert.equal(vm.chat.drawer.length, 4);
  assert.equal(vm.people.counts.deceased, 2);
  assert.equal(vm.people.notSeenLately, 1);
});

test('fixture("rpgOff") hides RPG-only card fields, points-to-spend, and torn gear', () => {
  const vm = fixture('rpgOff');
  assert.equal(vm.card.rpg, false);
  assert.equal(vm.card.you.levelText, null);
  assert.equal(vm.card.chips.soakPct, null);
  assert.equal(vm.card.chips.party, null);
  assert.equal(vm.card.chips.pace.kmDay, 20);
  assert.deepEqual(vm.card.bars, []);
  assert.equal(vm.card.exp, null);
  assert.equal(vm.now.needsYou.length, 1);
  assert.deepEqual(vm.now.today.torn, []);
  assert.equal(vm.chat.inlineRow.needsYou.n, 1);
});

test('fixture("fightOpen") switches to 2:10 pm Auvoth bridge with party only', () => {
  const vm = fixture('fightOpen');
  assert.equal(vm.card.scene.time, '2:10 pm');
  assert.equal(vm.now.today.trip.state, 'road');
  assert.equal(vm.now.needsYou.length, 3);
  assert.equal(vm.now.needsYou[0].kind, 'fight');
  assert.equal(vm.chat.inlineRow.fightOpen, true);
  assert.equal(vm.chat.inlineRow.needsYou.n, 3);
  assert.deepEqual(vm.chat.drawer.map(p => p.personId), ['torka', 'brann', 'rika']);
});

test('fixture("empty") empties drawer, needsYou, here, thisTurn, and pinned', () => {
  const vm = fixture('empty');
  assert.deepEqual(vm.now.needsYou, []);
  assert.deepEqual(vm.now.here, []);
  assert.equal(vm.now.thisTurn.count, 0);
  assert.deepEqual(vm.now.pinned, []);
  assert.deepEqual(vm.chat.drawer, []);
  assert.equal(vm.chat.inlineRow.changes, 0);
  assert.equal(vm.chat.inlineRow.needsYou.n, 0);
});

test('fixture({ notApplied: true }) flags unapplied change on inlineRow and replyMenu', () => {
  const vm = fixture({ notApplied: true });
  assert.equal(vm.chat.inlineRow.notApplied, 1);
  assert.equal(vm.chat.replyMenus[2].counts.notApplied, 1);
});

test('fight-open here list keeps the mock fight-state meters for Rika; People keeps its own', () => {
  const rika = fixture('fightOpen').now.here.find(p => p.personId === 'rika');
  assert.deepEqual(rika.meters, { trust: 26, affection: 6, desire: 0, tension: 3 });
  assert.equal(fixture().people.elsewhere.find(p => p.personId === 'rika').meters.trust, 30);
});

test('Story-only keeps the status chips but drops the RPG-only stance, as the mock does', () => {
  assert.deepEqual(fixture('rpgOff').card.statuses.map(s => s.id), ['bleeding', 'winded']);
  assert.deepEqual(fixture().card.statuses.map(s => s.id), ['shadow-step', 'bleeding', 'winded']);
});
