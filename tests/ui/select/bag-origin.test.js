// An item's "From" is a worded origin; the receipt id a stack records ("rc_…") is never shown to the reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBag } from '../../../ui/select/bag.js';

const row = o => ({ stack: 's', def: 'd', name: 'Thing', kind: 'goods', rarity: 'common', value: 5, slot: null, qty: 1, owner: 'party', equipped: null, note: '', from: '', ...o });

test('the item sheet keeps a worded origin and drops a receipt id', () => {
  const bag = selectBag({ items: [row({ stack: 'a', from: 'rc_ldwu4fro' }), row({ stack: 'b', from: 'Saltmarsh ruin' })] });
  const from = id => bag.items.find(item => item.stack === id).from;
  assert.equal(from('a'), '');
  assert.equal(from('b'), 'Saltmarsh ruin');
});

import { selectRpgRows } from '../../../ui/select/rpg-rows.js';

test('the "Over the load limit" row reads "Built in", not a bare "rule"', () => {
  const row = selectRpgRows({}).find(r => r.key === 'rpg.overLoad');
  assert.equal(row.value, 'Built in');
});
