import test from 'node:test';
import assert from 'node:assert/strict';
import { slotsDoll, portraitEl } from '../../../../ui/tabs/party/slots.js';
import { makeCtx, sheetEl } from './helpers.js';

test('the doll shows five slots each side of the portrait in order', () => {
  const ctx = makeCtx();
  const doll = slotsDoll(ctx.party.members[0], ctx);
  const [left, right] = doll.querySelectorAll('.dcol');
  assert.deepEqual(left.querySelectorAll('.slot').map(s => s.dataset.slot), ['head', 'armor', 'cloak', 'feet', 'mount']);
  assert.deepEqual(right.querySelectorAll('.slot').map(s => s.dataset.slot), ['weapon', 'offhand', 'accessory1', 'accessory2', 'bag']);
  assert.equal(doll.querySelector('.big').textContent, 'A');
});

test('slots carry rarity edges, dashed empties, torn marks and full accessible names', () => {
  const ctx = makeCtx();
  const doll = slotsDoll(ctx.party.members[0], ctx);
  const slot = key => doll.querySelector(`[data-slot="${key}"]`);
  assert.equal(slot('head').classList.contains('empty'), true);
  assert.equal(slot('head').getAttribute('aria-label'), 'Head: empty');
  assert.equal(slot('head').getAttribute('title'), 'Head: empty, tap to equip');
  assert.equal(slot('weapon').classList.contains('r-rare'), true);
  assert.equal(slot('mount').classList.contains('r-unc'), true);
  assert.equal(slot('armor').classList.contains('empty'), false);
  assert.equal(slot('armor').className, 'slot');
  assert.equal(slot('offhand').getAttribute('aria-label'), 'Offhand: Oak round shield, torn');
  assert.equal(slot('offhand').querySelector('.torn') !== null, true);
  assert.equal(slot('weapon').querySelector('.torn'), null);
  assert.equal(slot('weapon').querySelector('.lf').textContent, 'Weapon');
  assert.equal(slot('weapon').querySelector('.ls').textContent, 'Weap.');
  assert.equal(slot('weapon').querySelector('b').textContent, 'Steel longsword');
  const brann = slotsDoll(ctx.party.members[1], ctx);
  assert.equal(brann.querySelector('[data-slot="accessory1"]').classList.contains('r-epic'), true);
});

test('tapping a slot opens its sheet; a member with missing slots still shows ten', () => {
  const ctx = makeCtx();
  const doll = slotsDoll(ctx.party.members[0], ctx);
  doll.querySelector('[data-slot="cloak"]').click();
  assert.match(sheetEl().textContent, /Astra · Cloak/);
  const bare = slotsDoll({ id: 'z', name: 'Zed', portrait: null, slots: [] }, ctx);
  assert.equal(bare.querySelectorAll('.slot.empty').length, 10);
  assert.equal(bare.querySelector('.big').textContent, 'Z');
});

test('portraitEl uses the image only for path-like values and never for markup-breaking text', () => {
  makeCtx();
  const url = portraitEl({ name: 'Ann', portrait: 'img/ann.webp' }, 'a');
  assert.equal(url.style.getPropertyValue('background-image'), 'url("img/ann.webp")');
  assert.equal(url.textContent, '');
  assert.equal(portraitEl({ name: 'Ann', portrait: 'data:image/png;base64,AAA' }, 'a').textContent, '');
  const id = portraitEl({ name: 'Ann', portrait: 'ann' }, 'a');
  assert.equal(id.textContent, 'A');
  assert.equal(id.dataset.portrait, 'ann');
  assert.equal(portraitEl({ name: 'Ann', portrait: 'x/");alert(1)' }, 'a').textContent, 'A');
  assert.equal(portraitEl({ name: 'Ann', portrait: null }, 'a').dataset.portrait, undefined);
});
