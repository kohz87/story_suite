import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../../ui/contract/bag.js';
import { assetsCard, assetSheet } from '../../../../ui/tabs/bag/assets.js';
import { makeCtx } from './helpers.js';

test('Assets starts folded with pace and counts in the summary, and remembers the fold', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = assetsCard(bagFixture(), ctx);
  const fold = card.querySelector('.afold');
  assert.equal(fold.getAttribute('aria-expanded'), 'false');
  assert.equal(fold.querySelector('.t').textContent, '20 km/day · 4 transport · 2 property');
  assert.equal(card.querySelector('.abody').dataset.open, 'false');
  fold.click();
  assert.equal(card.querySelector('.abody').dataset.open, 'true');
  assert.equal(ctx.prefs.getFold('bag.assets', false), true);
  assert.equal(assetsCard(bagFixture(), ctx).querySelector('.afold').getAttribute('aria-expanded'), 'true');
  fold.click();
  assert.equal(card.querySelector('.abody').dataset.open, 'false');
});

test('pace box shows kmDay and why; slowed marks the fold and the box', () => {
  installFakeDom();
  const card = assetsCard(bagFixture({ over: true }), makeCtx());
  assert.equal(card.querySelector('.pr b').textContent, '15 km/day');
  assert.equal(card.querySelector('.pacebox').classList.contains('slow'), true);
  assert.equal(card.querySelector('.afold').classList.contains('slow'), true);
  assert.match(card.querySelector('.pacebox p').textContent, /over the load limit/);
});

test('Transport rows: riders, kind, seats, where; tags equipped, not with you; Property tags rented, owned', () => {
  installFakeDom();
  const card = assetsCard(bagFixture(), makeCtx());
  const rows = card.querySelectorAll('.tr');
  assert.equal(rows.length, 6);
  assert.match(rows[0].querySelector('.bmt').textContent, /^\u00a0ridden by Astrahorsewith the party$/);
  assert.deepEqual(rows.map(r => r.querySelector('.tg').textContent), ['equipped', 'equipped', 'not with you', 'water', 'rented', 'owned']);
  assert.equal(rows[0].querySelector('.tg').classList.contains('eq'), true);
  assert.match(rows[2].querySelector('.bmt').textContent, /2 seats/);
  assert.deepEqual(card.querySelectorAll('.asub').map(a => a.textContent), ['Transport', 'Property']);
});

test('Story-only shows no equipped tag on a ridden animal, as the mock hides it', () => {
  installFakeDom();
  const card = assetsCard(bagFixture({ rpg: false }), makeCtx());
  const rows = card.querySelectorAll('.tr');
  assert.equal(rows[0].querySelector('.tg'), null);
  assert.equal(rows[2].querySelector('.tg').textContent, 'not with you');
});

test('tapping a row opens the asset sheet with riders, seats, where and condition', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = assetsCard(bagFixture(), ctx);
  card.querySelector('.tr').click();
  assert.equal(ctx.sheets[0][1], 'Dappled mare');
  const kv = ctx.sheets[0][0].querySelector('.kv').textContent;
  assert.match(kv, /RidersAstra/);
  assert.match(kv, /Seats1/);
  assert.match(kv, /ConditionGood, rested/);
  card.querySelectorAll('.tr')[5].click();
  const prop = ctx.sheets[1][0].querySelector('.kv').textContent;
  assert.match(prop, /Stayingnobody/);
  assert.equal(/Seats|Condition/.test(prop), false);
});

test('assetSheet hides condition when Story-only; the card is null with nothing to show', () => {
  installFakeDom();
  const a = bagFixture().assets.transport[0];
  assert.equal(assetSheet(a, 'transport', { rpg: false }).querySelector('.kv').textContent.includes('Condition'), false);
  assert.equal(assetsCard({ rpg: true, pace: null, assets: { transport: [], property: [] } }, {}), null);
  assert.ok(assetsCard({ rpg: false, pace: bagFixture().pace, assets: { transport: [], property: [] } }, {}));
  assert.equal(assetsCard({}, {}), null);
});
