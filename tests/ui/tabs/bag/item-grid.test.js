import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { itemsCard, itemTile, memberName, KIND_LABEL } from '../../../../ui/tabs/bag/item-grid.js';
import { makeCtx } from './helpers.js';

const rows = card => card.querySelectorAll('.itm');

test('default filter is In bag: carried items only, with counts on the chips', () => {
  installFakeDom();
  const bag = bagFixture();
  const card = itemsCard(bag, makeCtx());
  const chips = card.querySelectorAll('.fil button');
  assert.equal(chips.length, 7);
  assert.match(chips[0].textContent, /^In bag/);
  assert.equal(chips[0].getAttribute('aria-pressed'), 'true');
  assert.equal(rows(card).length, bag.filters[0].count);
  assert.equal(rows(card).some(r => r.dataset.stack === 'steel-longsword'), false);
});

test('Worn lists worn items with the wearer name; other chips filter by kind', () => {
  installFakeDom();
  const bag = bagFixture();
  const card = itemsCard(bag, makeCtx());
  card.querySelector('[data-f="worn"]').click();
  assert.equal(rows(card).length, bag.filters[1].count);
  assert.equal(rows(card)[0].querySelector('.k').textContent, 'Astra');
  card.querySelector('[data-f="use"]').click();
  assert.deepEqual(rows(card).map(r => r.querySelector('.k').textContent), ['Use', 'Use', 'Use']);
  assert.equal(card.querySelector('[data-f="use"]').getAttribute('aria-pressed'), 'true');
});

test('typing in Find searches all items by name and clears the filter highlight', () => {
  installFakeDom();
  const card = itemsCard(bagFixture(), makeCtx());
  const search = card.querySelector('.srch');
  assert.equal(search.hasAttribute('hidden'), true);
  card.querySelector('.ihead button').click();
  assert.equal(search.hasAttribute('hidden'), false);
  search.value = ' LONGSWORD ';
  search.dispatch('input');
  assert.equal(rows(card).length, 1);
  assert.equal(card.querySelector('.fil [aria-pressed="true"]'), null);
  search.value = 'zzz';
  search.dispatch('input');
  assert.equal(card.querySelector('.fine').textContent, 'Nothing here.');
  card.querySelector('[data-f="all"]').click();
  assert.equal(search.value, '');
});

test('tapping a tile hands the item to onItem', () => {
  installFakeDom();
  const got = [];
  const card = itemsCard(bagFixture(), { ...makeCtx(), onItem: it => got.push(it.stack) });
  rows(card)[0].click();
  assert.equal(got.length, 1);
});

test('tile marks: rarity, quantity, new, torn, wearer; Story-only drops rarity and torn', () => {
  installFakeDom();
  const items = bagFixture().items;
  const draught = itemTile(items.find(i => i.stack === 'healing-draught'), true);
  assert.equal(draught.querySelector('.q').textContent, '×3');
  assert.ok(draught.querySelector('.nw'));
  const shield = itemTile(items.find(i => i.stack === 'oak-round-shield'), true);
  assert.ok(shield.querySelector('.wear'));
  assert.ok(shield.querySelector('.wr'));
  assert.equal(shield.classList.contains('r-unc'), true);
  const plain = itemTile(items.find(i => i.stack === 'oak-round-shield'), false);
  assert.equal(plain.querySelector('.wear'), null);
  assert.equal(plain.classList.contains('r-unc'), false);
  const unknownGlyph = itemTile({ ...items[0], glyph: 'nope', qty: 1, wornBy: null, isNew: false }, true);
  assert.ok(unknownGlyph.querySelector('svg'));
});

test('empty bag hides the card; Story-only grid is marked norpg', () => {
  installFakeDom();
  assert.equal(itemsCard({ rpg: true, items: [], filters: [] }, {}), null);
  assert.equal(itemsCard(undefined, {}), null);
  assert.equal(itemsCard(bagFixture({ rpg: false }), makeCtx()).querySelector('.igrid').classList.contains('norpg'), true);
});

test('memberName uses ctx.members, then the capitalised id, then empty', () => {
  assert.equal(memberName('astra', { members: { astra: 'Astra Vey' } }), 'Astra Vey');
  assert.equal(memberName('brann'), 'Brann');
  assert.equal(memberName(null), '');
  assert.equal(KIND_LABEL.material, 'Materials');
});
