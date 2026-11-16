import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { core, stocked, stack } from '../../../../packages/story-block/tests/v2/domains/fixtures.js';
import { createHarness } from '../../../../packages/story-block/tests/v2/domains/helpers/fake-ctx.js';
import { itemEditForm, itemPatch } from '../../../../ui/tabs/bag/item-edit.js';
import { buildSelectors } from '../../../../ui/select/build.js';

// Three unstacked Lanterns and a stacking item, edited through the real inventory.edit command.
function setup() {
  const rules = core();
  const state = stocked(rules);
  const inv = state.domains.inventory;
  inv.stacks.it_lant0002 = stack('it_lant0002', 'story/lantern', 1);
  inv.stacks.it_lant0003 = stack('it_lant0003', 'story/lantern', 1);
  const h = createHarness(rules, { state });
  const read = (type, args) => h.query?.(type, args) ?? h.read?.(type, args);
  const bag = () => buildSelectors(() => null, null).bag(read);
  return { h, bag };
}
const pieces = h => Object.values(h.state.domains.inventory.stacks).filter(s => s.def === 'story/lantern').length;

test('Count shows the grouped piece count; 4 makes 4 pieces, 1 makes 1', () => {
  installFakeDom();
  const { h, bag } = setup();
  const item = bag().items.find(i => i.name === 'Lantern');
  assert.equal(item.qty, 1);
  assert.equal(item.count, 3);
  const form = itemEditForm(item, {});
  assert.equal(form.querySelector('input[type="number"]').value, '3');
  assert.equal(itemPatch(item, { name: item.name, qty: '3', note: item.note }), null);
  assert.equal(h.run('inventory.edit', itemPatch(item, { name: item.name, qty: '4', note: item.note })).ok, true);
  assert.equal(pieces(h), 4);
  const again = bag().items.find(i => i.name === 'Lantern');
  assert.equal(h.run('inventory.edit', itemPatch(again, { name: again.name, qty: '1', note: again.note })).ok, true);
  assert.equal(pieces(h), 1);
});

test('a stacking item still sets stack.qty', () => {
  const { h, bag } = setup();
  const item = bag().items.find(i => i.stack === 'it_rope0001');
  assert.equal(item.count, 3);
  assert.equal(item.qty, 3);
  const r = h.run('inventory.edit', itemPatch(item, { name: item.name, qty: String(item.qty + 2), note: item.note }));
  assert.equal(r.ok, true);
  assert.equal(h.state.domains.inventory.stacks[item.stack].qty, item.qty + 2);
});
