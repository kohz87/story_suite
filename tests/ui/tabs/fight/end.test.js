import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { endCard, offerCard } from '../../../../ui/tabs/fight/end.js';
import { fightFixture } from './helpers.js';

test('offer: counts the foes and has three choices that call their handlers', () => {
  installFakeDom();
  const hit = [];
  const card = offerCard({ foes: 4, onBoard: () => hit.push('board'), onAuto: () => hit.push('auto'), onStory: () => hit.push('story') });
  assert.match(card.querySelector('.anote').textContent, /^4 foes stand in your way\./);
  assert.deepEqual(card.querySelectorAll('button').map(b => b.textContent), ['Fight on the board', 'Auto-fight', 'Keep telling the story']);
  card.querySelector('[data-offer="board"]').click();
  card.querySelector('[data-offer="auto"]').click();
  card.querySelector('[data-offer="story"]').click();
  assert.deepEqual(hit, ['board', 'auto', 'story']);
  assert.match(offerCard({ foes: 1 }).querySelector('.anote').textContent, /^1 foe stands/);
});

test('end: won shows XP, exchanges, foes down, and each member with health and practice', () => {
  installFakeDom();
  const vm = fightFixture('end');
  const card = endCard(vm.end, { party: vm.party, down: { down: 4, total: 4 } });
  assert.equal(card.querySelector('.big2').textContent, 'Won');
  assert.deepEqual(card.querySelectorAll('.xpr div').map(d => d.textContent), ['+45 XP' + 'each', '3exchanges', '4 of 4foes down']);
  const rows = card.querySelectorAll('.endr');
  assert.equal(rows.length, 4);
  assert.match(rows[0].textContent, /AstraHealth 11\/14 · Stamina 6\/15 · Mana 14\/14Iaijutsu \+3Shadow Step \+3/);
  assert.equal(card.querySelectorAll('.prc i').length, 7);
});

test('end: Back to the story and Discard call their handlers', () => {
  installFakeDom();
  const hit = [];
  const card = endCard(fightFixture('end').end, { onBack: () => hit.push('back'), onDiscard: () => hit.push('discard') });
  card.querySelector('[data-finish]').click();
  card.querySelector('[data-discard]').click();
  assert.deepEqual(hit, ['back', 'discard']);
});

test('end: fled and lost have their own headline; an unknown member shows its id; no end gives null', () => {
  installFakeDom();
  const end = fightFixture('end').end;
  assert.equal(endCard({ ...end, outcome: 'fled' }).querySelector('.big2').textContent, 'Fled');
  assert.equal(endCard({ ...end, outcome: 'lost' }).classList.contains('is-lost'), true);
  assert.equal(endCard({ ...end, exchanges: 1 }).querySelectorAll('.xpr div')[1].textContent, '1exchange');
  assert.equal(endCard(end).querySelector('.endr b').textContent, 'astra');
  assert.equal(endCard(end).querySelectorAll('.xpr div').length, 2);
  assert.equal(endCard(null), null);
});
