import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { partyCard } from '../../../../ui/tabs/fight/party-strip.js';
import { fightFixture } from './helpers.js';

const opts = (vm, extra = {}) => ({ step: 'choose', exchange: vm.exchange, actorId: vm.actor?.id, ...extra });

test('party: while choosing, one fold row of four cells plus the full list; the actor is marked and picks show a tick', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  const card = partyCard(vm.party, opts(vm));
  const cells = card.querySelectorAll('.fold-view .pm');
  assert.equal(cells.length, 4);
  assert.equal(cells.filter(c => c.classList.contains('act')).length, 1);
  assert.equal(card.querySelectorAll('.fold-view .ok').length, 3);
  assert.equal(card.querySelector('.cnt').textContent, 'exchange 2 · 3 of 4 chosen');
  assert.equal(card.dataset.open, 'false');
});

test('party: tapping a fold cell or Fold calls onToggle', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  let n = 0;
  const card = partyCard(vm.party, opts(vm, { onToggle: () => { n += 1; } }));
  card.querySelector('.fold-view .pm').click();
  card.querySelector('.pfold-btn').click();
  assert.equal(n, 2);
});

test('party: full cells show health, Stamina and what each member chose; the actor says choosing', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  const cells = partyCard(vm.party, opts(vm)).querySelectorAll('.full-view .pm');
  assert.match(cells[0].textContent, /Astra.*Health 11\/14.*Stamina 9\/15.*Iaijutsu → Hound 2/);
  const brann = cells.find(c => c.dataset.member === 'brann');
  assert.match(brann.querySelector('.ch2').textContent, /choosing…/);
});

test('party: the ally step makes cells buttons, previews the heal for the hurt only, and reports the pick', () => {
  installFakeDom();
  const vm = fightFixture('ally');
  const picked = [];
  const card = partyCard(vm.party, opts(vm, { step: 'ally', heal: 6, onAlly: id => picked.push(id) }));
  assert.equal(card.querySelector('.fold-view'), null);
  const buttons = card.querySelectorAll('button.pm');
  assert.equal(buttons.length, 4);
  const torka = buttons.find(b => b.dataset.ally === 'torka');
  assert.match(torka.textContent, /Health 7\/14 → 13/);
  assert.equal(buttons.find(b => b.dataset.ally === 'brann').querySelector('.heal'), null);
  torka.click();
  assert.deepEqual(picked, ['torka']);
});

test('party: offer says "4 here" and after says "exchange 2 done"; neither has a fold view', () => {
  installFakeDom();
  const offer = fightFixture('offer');
  const a = partyCard(offer.party, { step: 'offer', exchange: 1 });
  assert.equal(a.querySelector('.cnt').textContent, '4 here');
  assert.equal(a.querySelector('.fold-view'), null);
  const after = fightFixture('after');
  const b = partyCard(after.party, { step: 'after', exchange: 2 });
  assert.equal(b.querySelector('.cnt').textContent, 'exchange 2 done');
  assert.match(b.querySelectorAll('.pm')[3].querySelector('.ch2').textContent, /Normal attack → Hound 3/);
  assert.equal(b.querySelector('.ch2').classList.contains('done'), true);
});

test('party: an empty party gives null', () => {
  installFakeDom();
  assert.equal(partyCard([]), null);
  assert.equal(partyCard(undefined), null);
});
