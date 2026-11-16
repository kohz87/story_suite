import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../../ui/contract/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { makeCtx } from './helpers.js';

const order = tab => tab.querySelectorAll('[data-card]').map(c => c.dataset.card);

test('Bag lists Purse, Assets, then Items; load sits inside Purse', () => {
  installFakeDom();
  const tab = bagTab(bagFixture(), makeCtx());
  assert.equal(tab.dataset.tab, 'bag');
  assert.deepEqual(order(tab), ['purse', 'assets', 'items']);
  assert.ok(tab.querySelector('[data-card="purse"] .load'));
  assert.equal(tab.querySelector('.btop').children.length, 2);
});

test('Story-only Bag has no load, no rarity and no wear marks', () => {
  installFakeDom();
  const tab = bagTab(bagFixture({ rpg: false }), makeCtx());
  assert.equal(tab.querySelector('.load'), null);
  assert.equal(tab.querySelector('.wear'), null);
  assert.equal(tab.querySelector('.r-rare'), null);
  assert.deepEqual(order(tab), ['purse', 'assets', 'items']);
});

test('tapping an item opens its sheet through ctx.openSheet; over the limit shows the over note', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = bagTab(bagFixture({ over: true }), ctx);
  assert.ok(tab.querySelector('.ovr'));
  tab.querySelector('.itm').click();
  assert.equal(ctx.sheets.length, 1);
  assert.equal(ctx.sheets[0][0].dataset.sheet, 'item');
  assert.equal(ctx.sheets[0][1], tab.querySelector('.itm .n').textContent);
});

test('empty parts are left out and an empty bag still renders', () => {
  installFakeDom();
  const tab = bagTab({ rpg: true, items: [], filters: [], purse: null, assets: { transport: [], property: [] }, pace: null }, {});
  assert.deepEqual(order(tab), []);
  assert.deepEqual(order(bagTab(undefined, {})), []);
});
