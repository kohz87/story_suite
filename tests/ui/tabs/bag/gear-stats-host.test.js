// The Bag's gear Stats over a real host: + Add with a pick (kit open, and after the kit through the repoint edit), the untouched default, Change, and the engine's refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { selectBag } from '../../../../ui/select/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { world, rowOf, defOf, skip } from '../../../modules/inventory/gear-start.helpers.js';

const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise(resolve => setImmediate(resolve)); };
const bagOf = host => selectBag({ rpg: true, items: host.sdk.query('inventory.items'), gear: host.sdk.query('gear.view', { id: 'ac_astra001' }), pcId: 'ac_astra001' });
const ctxOf = host => {
  const sheets = [];
  return { sheets, members: {}, port: { command: (type, payload) => host.sdk.command(type, payload) }, openSheet: (el, label) => sheets.push([el, label]), close: () => {} };
};
const stats = (host, name) => host.sdk.query('gear.view', { owner: 'party' }).rows[rowOf(host, name).stack].bonus;

// (the Items card, and its + Add, is drawn only once the bag holds something: a rope first)
async function addVia(host, name, steps) {
  if (!rowOf(host, 'Rope')) await host.sdk.command('inventory.add', { name: 'Rope', qty: 1 });
  installFakeDom();
  const ctx = ctxOf(host);
  bagTab(bagOf(host), ctx).querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  const form = ctx.sheets[0][0];
  const kind = form.querySelector('select');
  kind.value = 'equipment';
  kind.dispatch('change');
  form.querySelector('input').value = name;
  form.querySelector('input').dispatch('input');
  steps?.(form);
  form.querySelector('.save').click();
  await flush();
  return form;
}

test('the Bag view-model carries Gear on, the kit and each gear piece\'s points', { skip }, async t => {
  const host = await world(t);
  assert.deepEqual(bagOf(host).gear, { on: true, kit: true });
  await host.sdk.command('inventory.add', { name: 'Jade Ring', qty: 1, kind: 'equipment' });
  assert.deepEqual(bagOf(host).items.find(i => i.name === 'Jade Ring').repoint, { budget: 1, stats: { CHA: 1 } }, 'an untouched ring: its one point on CHA');
  const off = await world(t, { gear: false });
  assert.equal(bagOf(off).gear.on, false);
});

test('kit open: + Add with a rarity and a two-stat pick makes that piece; untouched gives the default', { skip }, async t => {
  const host = await world(t);
  await addVia(host, 'Wolfskin Cap', form => {
    const rarity = form.querySelector('select[aria-label="Rarity"]');
    rarity.value = 'rare';
    rarity.dispatch('change');
    form.querySelector('[data-minus="VIT"]').click();
    form.querySelector('[data-plus="AGI"]').click();
  });
  assert.deepEqual([defOf(host, 'Wolfskin Cap').rarity, defOf(host, 'Wolfskin Cap').stats], ['rare', { VIT: 2, AGI: 1 }]);
  await addVia(host, 'Silver Ring');
  assert.equal(stats(host, 'Silver Ring'), '+1 CHA');
});

test('after the kit: + Add is Common and a changed pick lands on the new piece through the repoint edit', { skip }, async t => {
  const host = await world(t);
  await host.send('Hello.', 'The road.');
  assert.equal(bagOf(host).gear.kit, false);
  const form = await addVia(host, 'Jade Ring', f => { f.querySelector('[data-minus="CHA"]').click(); f.querySelector('[data-plus="INT"]').click(); });
  assert.equal(form.querySelector('.err').hasAttribute('hidden'), true, form.querySelector('.err').textContent);
  assert.equal(defOf(host, 'Jade Ring').rarity, 'common');
  assert.equal(stats(host, 'Jade Ring'), '+1 INT');
});

test('Change on the item sheet moves the points; Gear off and a budget of 0 show the engine\'s own sentence', { skip }, async t => {
  const host = await world(t, { packs: true, items: [{ name: 'Plain Band', kind: 'equipment', slot: 'accessory', rarity: 'rare', bonus: 0 }] });
  await host.sdk.command('inventory.add', { name: 'Iron Sword', qty: 1, kind: 'equipment', rarity: 'uncommon' });
  await host.sdk.command('inventory.add', { name: 'Plain Band', qty: 1 });
  await host.send('Hello.', 'The road.');
  installFakeDom();
  const ctx = { ...ctxOf(host), rpg: true };
  const sword = bagOf(host).items.find(i => i.name === 'Iron Sword');
  const el = itemSheet(sword, ctx);
  el.querySelector('[data-change="stats"]').click();
  const view = el.querySelector('[data-form="item-stats"]');
  view.querySelector('[data-minus="DEX"]').click();
  view.querySelector('[data-plus="STR"]').click();
  view.querySelector('[data-save="stats"]').click();
  await flush();
  assert.equal(stats(host, 'Iron Sword'), '+1 STR +1 DEX');
  const band = bagOf(host).items.find(i => i.name === 'Plain Band');
  assert.equal(band.repoint, undefined, 'the pack\'s bonus 0: no points to move');
  const locked = itemSheet(band, ctx);
  locked.querySelector('[data-change="stats"]').click();
  await flush();
  assert.equal(locked.querySelector('.gst-why').textContent, 'This piece gives no points to move.');
  assert.equal(locked.querySelector('[data-form="item-stats"]'), null);
  const off = await world(t, { gear: false });
  await off.sdk.command('inventory.add', { name: 'Iron Sword', qty: 1 });
  const offItem = { ...bagOf(off).items.find(i => i.name === 'Iron Sword'), kind: 'gear' };
  const offSheet = itemSheet(offItem, { ...ctxOf(off), rpg: true });
  offSheet.querySelector('[data-change="stats"]').click();
  await flush();
  assert.equal(offSheet.querySelector('.gst-why').textContent, 'Gear in fights is not switched on.');
});
