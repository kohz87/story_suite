import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { actionsCard, afterCard } from '../../../../ui/tabs/fight/actions.js';
import { fightFixture } from './helpers.js';

function build(extra = {}) {
  const vm = fightFixture('choose');
  const member = vm.party.find(p => p.id === vm.actor.id);
  return { vm, card: actionsCard(vm.actor, member, { party: vm.party, ...extra }) };
}

test('actions: header, who has chosen, and the Mana and Stamina bars', () => {
  installFakeDom();
  const { card } = build();
  assert.equal(card.querySelector('.ah b').textContent, 'Brann: choose an action');
  assert.equal(card.querySelector('.ah small').textContent, '4 of 4');
  assert.equal(card.querySelector('.chose').textContent, 'Astra, Torka and Rika have chosen.');
  const res = card.querySelectorAll('.res2 div');
  assert.match(res[0].textContent, /Mana 12\/12/);
  assert.match(res[1].textContent, /Stamina 10\/14/);
});

test('actions: tiles come in the order Attack, Magic, then Item and Flee side by side, numbered 1-9', () => {
  installFakeDom();
  const { card } = build();
  assert.deepEqual(card.querySelectorAll('.agrp').map(g => g.textContent), ['Attack', 'Magic', 'Item', 'Flee']);
  assert.equal(card.querySelectorAll('.agpair .agrp').length, 2);
  const tiles = card.querySelectorAll('.at');
  assert.deepEqual(tiles.map(t => t.dataset.key), ['1', '2', '3', '4', '5', '6']);
  assert.match(tiles[0].textContent, /Normal attackSTR damage · free5 damage · 7 if decisive/);
  assert.equal(tiles[2].classList.contains('area'), true);
  assert.equal(tiles[5].querySelector('.odds').textContent, 'long shot');
  assert.equal(tiles[5].querySelector('.odds').classList.contains('long'), true);
});

test('actions: a tile reports its action; a tile that is not enabled is disabled and says not enough', () => {
  installFakeDom();
  const picked = [];
  const vm = fightFixture('choose');
  vm.actor.groups.Attack[1].enabled = false;
  const card = actionsCard(vm.actor, vm.party[3], { party: vm.party, onPick: a => picked.push(a.id) });
  card.querySelectorAll('.at')[0].click();
  assert.deepEqual(picked, ['normal']);
  const heavy = card.querySelectorAll('.at')[1];
  assert.equal(heavy.hasAttribute('disabled'), true);
  assert.match(heavy.querySelector('small').textContent, /not enough/);
});

test('actions: keys 1-9 press the matching tile; a disabled tile or other key does nothing', () => {
  installFakeDom();
  const picked = [];
  const vm = fightFixture('choose');
  vm.actor.groups.Attack[1].enabled = false;
  const card = actionsCard(vm.actor, vm.party[3], { party: vm.party, onPick: a => picked.push(a.id) });
  card.dispatch('keydown', { key: '3' });
  card.dispatch('keydown', { key: '2' });
  card.dispatch('keydown', { key: '9' });
  card.dispatch('keydown', { key: 'x' });
  assert.deepEqual(picked, ['cleave']);
});

test('actions: the selected tile is marked', () => {
  installFakeDom();
  const { card } = build({ sel: 'magic' });
  assert.deepEqual(card.querySelectorAll('.at.sel').map(t => t.dataset.act), ['magic']);
});

test('actions: the stance switch shows what it gives now and sends its new state', () => {
  installFakeDom();
  const seen = [];
  const { card } = build({ onStance: on => seen.push(on) });
  assert.equal(card.querySelector('.stance .now').textContent, 'now: soak 22%');
  assert.match(card.querySelector('.stance small').textContent, /^Shield wall: soak 17% \+ 5% · 1 Stamina each exchange/);
  const sw = card.querySelector('.sw');
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  sw.click();
  assert.deepEqual(seen, [false]);
});

test('actions: a stance that is off shows the off text; no stance means no row', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  vm.actor.stance.on = false;
  const off = actionsCard(vm.actor, vm.party[3], { party: vm.party });
  assert.equal(off.querySelector('.now'), null);
  assert.equal(off.querySelector('.stance small').textContent, 'Off: soak 17%. No Stamina from this exchange on.');
  const plain = { ...vm.actor, stance: { name: 'Calm', on: false, soakOn: null, soakOff: null, pool: 'Stamina', cost: 1, paid: null } };
  assert.equal(actionsCard(plain, vm.party[3], { party: vm.party }).querySelector('.stance small').textContent, 'Off: no Stamina from this exchange on.');
  const magic = { ...plain, stance: { ...plain.stance, name: 'Ward', pool: 'Mana' } };
  assert.equal(actionsCard(magic, vm.party[3], { party: vm.party }).querySelector('.stance small').textContent, 'Off: no Mana from this exchange on.');
  magic.stance.on = true;
  assert.equal(actionsCard(magic, vm.party[3], { party: vm.party }).querySelector('.stance small').textContent, 'Ward: 1 Mana each exchange, paid at its start; off when Mana runs out');
  vm.actor.stance = null;
  assert.equal(actionsCard(vm.actor, vm.party[3], { party: vm.party }).querySelector('.stance'), null);
});

test('actions: Back, Auto and Discard fight call their handlers', () => {
  installFakeDom();
  const hit = [];
  const { card } = build({ onBack: () => hit.push('back'), onAuto: () => hit.push('auto'), onDiscard: () => hit.push('discard') });
  card.querySelector('[data-back]').click();
  card.querySelector('[data-auto]').click();
  card.querySelector('[data-discard]').click();
  assert.deepEqual(hit, ['back', 'auto', 'discard']);
  assert.equal(card.querySelector('[data-discard]').classList.contains('dng'), true);
});

test('actions: no actor or no member gives null; an empty kind is left out', () => {
  installFakeDom();
  const vm = fightFixture('choose');
  assert.equal(actionsCard(null, vm.party[0]), null);
  assert.equal(actionsCard(vm.actor, undefined), null);
  vm.actor.groups.Item = [];
  const card = actionsCard(vm.actor, vm.party[3], { party: vm.party });
  assert.deepEqual(card.querySelectorAll('.agrp').map(g => g.textContent), ['Attack', 'Magic', 'Flee']);
});

test('afterCard: names the resolved exchange, the next one, and calls the handlers', () => {
  installFakeDom();
  const hit = [];
  const card = afterCard({ exchange: 2, note: 'Hound 3 down.', onNext: () => hit.push('next'), onAuto: () => hit.push('auto') });
  assert.equal(card.querySelector('.ah b').textContent, 'Exchange 2 resolved');
  assert.equal(card.querySelector('.anote').textContent, 'Hound 3 down.');
  assert.equal(card.querySelector('[data-next]').textContent, 'Choose exchange 3');
  card.querySelector('[data-next]').click();
  card.querySelector('[data-auto]').click();
  assert.deepEqual(hit, ['next', 'auto']);
  assert.equal(afterCard().querySelector('.anote'), null);
});
