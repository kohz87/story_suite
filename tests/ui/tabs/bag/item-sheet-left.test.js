// An item someone who left still holds: the sheet offers Take back (a bag keeps its Put down), which hands it to the party.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../../ui/contract/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { makeCtx } from './helpers.js';

const base = () => bagFixture({ rpg: true }).items.find(i => i.name === 'Spare dagger');
const labels = el => el.querySelectorAll('.btn2').map(button => button.textContent);
const press = (el, label) => el.querySelectorAll('.btn2').find(button => button.textContent === label).click();

test('Take back replaces Wear on and Take off, sends the whole stack to the party and names who holds it', () => {
  installFakeDom();
  for (const wornBy of [null, 'ac_gone0001']) {
    const item = { ...base(), wornBy, gone: 'Torka' }, ctx = { ...makeCtx(), rpg: true };
    assert.deepEqual(checkShape({ ...bagFixture(), items: [item] }, BAG_SHAPE), []);
    const el = itemSheet(item, ctx);
    assert.ok(labels(el).includes('Take back'));
    assert.equal(labels(el).some(label => label === 'Take off' || label === 'Wear on…'), false);
    assert.match(el.querySelector('.kv').textContent, wornBy ? /Worn byTorka/ : /Held byTorka/);
    press(el, 'Take back');
    assert.deepEqual(ctx.sent[0], ['inventory.transfer', { stack: item.stack, to: 'party' }]);
  }
});

test('their bag keeps Put down; a bound piece and an item of someone in the party have no Take back', () => {
  installFakeDom();
  const ctx = { ...makeCtx(), rpg: true };
  const bag = itemSheet({ ...base(), wornBy: 'ac_gone0001', gone: 'Torka', isBag: true, bagLike: true }, ctx);
  assert.equal(labels(bag).includes('Take back'), false);
  press(bag, 'Put down');
  assert.deepEqual(ctx.sent[0], ['inventory.bag', { owner: 'ac_gone0001', stack: null }]);
  assert.equal(labels(itemSheet({ ...base(), gone: 'Torka', bound: true }, ctx)).includes('Take back'), false);
  assert.equal(labels(itemSheet(base(), ctx)).includes('Take back'), false);
});
