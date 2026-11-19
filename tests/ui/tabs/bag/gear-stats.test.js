// The gear Stats picker (Bag + Add and Change): at most two stats, the total held to the budget, the name's default stat untouched, and the engine's refusal shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { statsPicker, defaultPick, statsLine } from '../../../../ui/tabs/bag/gear-stats.js';
import { gearAddPlan, slotFor } from '../../../../ui/tabs/bag/item-add-gear.js';
import { makeCtx } from './helpers.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const plus = (el, k) => el.querySelector(`[data-plus="${k}"]`);
const minus = (el, k) => el.querySelector(`[data-minus="${k}"]`);
const disabled = button => button.disabled === true || (button.disabled !== false && button.getAttribute('disabled') !== null);

test('the picker places at most the budget on at most two stats, and says "n of N points"', () => {
  installFakeDom();
  const picker = statsPicker({ budget: 3, stats: {} });
  assert.match(picker.el.querySelector('.gst-n').textContent, /^0 of 3 points/);
  plus(picker.el, 'DEX').click();
  plus(picker.el, 'AGI').click();
  assert.equal(disabled(plus(picker.el, 'STR')), true, 'a third stat cannot be raised');
  assert.equal(disabled(plus(picker.el, 'DEX')), false);
  plus(picker.el, 'STR').click();
  assert.deepEqual(picker.value(), { DEX: 1, AGI: 1 }, 'a click on a third stat changes nothing');
  plus(picker.el, 'DEX').click();
  assert.deepEqual(picker.value(), { DEX: 2, AGI: 1 });
  assert.equal(picker.full(), true);
  assert.equal(disabled(plus(picker.el, 'DEX')), true, 'every point is placed');
  plus(picker.el, 'AGI').click();
  assert.deepEqual(picker.value(), { DEX: 2, AGI: 1 }, 'never past the budget');
  assert.match(picker.el.querySelector('.gst-n').textContent, /^3 of 3 points/);
  minus(picker.el, 'AGI').click();
  assert.deepEqual(picker.value(), { DEX: 2 });
  assert.equal(disabled(plus(picker.el, 'STR')), false, 'a freed stat slot can be used again');
  assert.equal(disabled(minus(picker.el, 'STR')), true, '− is off at 0');
});

test('the rows are the Party stat sheet rows; LUK shows only for a piece that still has points on it, and there is no WIS (gear cannot raise it)', () => {
  installFakeDom();
  const rows = picker => picker.el.querySelectorAll('.ps-st').map(row => row.dataset.stat);
  assert.deepEqual(rows(statsPicker({ budget: 1 })), ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'CHA']);
  assert.deepEqual(rows(statsPicker({ budget: 2, stats: { LUK: 2 } })), ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'CHA', 'LUK']);
  assert.equal(statsLine({ AGI: 1, DEX: 1 }), '+1 DEX · +1 AGI');
  assert.equal(statsLine({}), '');
});

test('the default pick is the stat the name or slot suggests, the whole budget on it (accessories: CHA)', () => {
  assert.deepEqual(defaultPick('Jade Ring', slotFor('Jade Ring', ''), 1), { CHA: 1 });
  assert.deepEqual(defaultPick('Iron Sword', 'weapon', 3), { DEX: 3 });
  assert.deepEqual(defaultPick('Plain Thing', 'accessory', 2), { CHA: 2 });
  assert.deepEqual(defaultPick('Old Boots', 'feet', 2), { AGI: 2 });
  assert.deepEqual(defaultPick('Lump', '', 1), {}, 'no slot: nothing');
  assert.equal(slotFor('Lump', ''), null);
});

test('the Add plan: untouched or the default sends no stats; the kit sends rarity and stats; after it the pick goes to the repoint edit; a pick not all placed is refused', () => {
  const base = { name: 'Jade Ring', slot: '', rarity: 'rare' };
  assert.deepEqual(gearAddPlan({ ...base, kit: true, pick: { CHA: 3 }, touched: false }), { add: { rarity: 'rare' }, repoint: null });
  assert.deepEqual(gearAddPlan({ ...base, kit: true, pick: { CHA: 3 }, touched: true }), { add: { rarity: 'rare' }, repoint: null }, 'moved back to the default');
  assert.deepEqual(gearAddPlan({ ...base, kit: true, slot: 'accessory', pick: { DEX: 2, INT: 1 }, touched: true }), { add: { slot: 'accessory', rarity: 'rare', stats: { DEX: 2, INT: 1 } }, repoint: null });
  assert.deepEqual(gearAddPlan({ ...base, kit: false, pick: { INT: 1 }, touched: true }), { add: {}, repoint: { INT: 1 } }, 'after the kit: Common, no stats on the add');
  assert.match(gearAddPlan({ ...base, kit: true, pick: { DEX: 1 }, touched: true }).error, /Place all 3 points: 1 placed/);
});

const openAdd = (gear, ctx = makeCtx()) => {
  const tab = bagTab({ ...bagFixture(), gear }, ctx);
  tab.querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  return [ctx.sheets[0][0], ctx];
};
const setKind = (form, value) => { const kind = form.querySelector('select'); kind.value = value; kind.dispatch('change'); };

test('+ Add: Gear in fights on and Kind = Equipment shows Slot, Rarity and Stats; the pick goes with the add while the kit is open', async () => {
  installFakeDom();
  const [form, ctx] = openAdd({ on: true, kit: true });
  const box = form.querySelector('.gst-add');
  assert.equal(box.hidden, true, 'hidden for Goods');
  setKind(form, 'equipment');
  assert.equal(box.hidden, false);
  const name = form.querySelector('input');
  name.value = 'Jade Ring';
  name.dispatch('input');
  assert.deepEqual(box.querySelectorAll('.ps-st .v.up').map(v => v.parentNode.dataset.stat), ['CHA'], 'the default stat is picked');
  const rarity = box.querySelector('select[aria-label="Rarity"]');
  rarity.value = 'uncommon';
  rarity.dispatch('change');
  assert.match(box.querySelector('.gst-n').textContent, /^2 of 2 points/);
  minus(box, 'CHA').click();
  plus(box, 'DEX').click();
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent[0], ['inventory.add', { name: 'Jade Ring', kind: 'equipment', qty: 1, rarity: 'uncommon', stats: { CHA: 1, DEX: 1 } }]);
});

test('+ Add after the kit: Rarity is fixed with the reason; a changed pick is the repoint edit on the new piece; an untouched one sends nothing more', async () => {
  installFakeDom();
  const ctx = makeCtx();
  ctx.port.command = (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve(type === 'inventory.add' ? { ok: true, receipt: { data: { stacks: ['st_9'] } } } : { ok: true }); };
  const [form] = openAdd({ on: true, kit: false }, ctx);
  setKind(form, 'equipment');
  assert.equal(form.querySelector('[data-rarity="fixed"]').textContent, 'Common');
  assert.match(form.querySelector('[data-why="rarity"]').textContent, /after the first message/);
  form.querySelector('input').value = 'Jade Ring';
  form.querySelector('input').dispatch('input');
  minus(form, 'CHA').click();
  plus(form, 'INT').click();
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.add', { name: 'Jade Ring', kind: 'equipment', qty: 1 }], ['inventory.edit', { stack: 'st_9', stats: { INT: 1 } }], ['close']]);
  const [plain, ctx2] = openAdd({ on: true, kit: false });
  setKind(plain, 'equipment');
  plain.querySelector('input').value = 'Jade Ring';
  plain.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx2.sent, [['inventory.add', { name: 'Jade Ring', kind: 'equipment', qty: 1 }], ['close']]);
});

test('+ Add with Gear in fights off has no gear fields', () => {
  installFakeDom();
  const [form] = openAdd({ on: false, kit: true });
  assert.equal(form.querySelector('.gst-add'), null);
});

const gearItem = extra => ({ ...bagFixture().items.find(i => i.name === 'Spare dagger'), ...extra });
const sheetOf = (item, command) => {
  const ctx = { ...makeCtx(), rpg: true };
  if (command) ctx.port.command = (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve(command(type, payload)); };
  return [itemSheet(item, ctx), ctx];
};

test('item sheet: Stats row with Change opens the picker on the piece\'s points and sends the repoint edit', async () => {
  installFakeDom();
  const [el, ctx] = sheetOf(gearItem({ repoint: { budget: 2, stats: { DEX: 1, AGI: 1 } } }));
  assert.match(el.querySelector('.kv').textContent, /Stats\+1 DEX · \+1 AGI/);
  el.querySelector('[data-change="stats"]').click();
  const view = el.querySelector('[data-form="item-stats"]');
  assert.match(view.querySelector('.gst-n').textContent, /^2 of 2 points/);
  minus(view, 'AGI').click();
  assert.equal(disabled(view.querySelector('[data-save="stats"]')), true, 'Save waits for every point');
  plus(view, 'STR').click();
  view.querySelector('[data-save="stats"]').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.edit', { stack: gearItem().stack, stats: { DEX: 1, STR: 1 } }], ['close']]);
});

test('item sheet: the engine\'s refusal shows in the note line (Change on a repointable piece, and on a bound piece, gear off or a budget of 0)', async () => {
  installFakeDom();
  const [el] = sheetOf(gearItem({ repoint: { budget: 1, stats: { DEX: 1 } } }), () => ({ ok: false, message: 'Rarity and bonuses come from the story after the first message.' }));
  el.querySelector('[data-change="stats"]').click();
  const view = el.querySelector('[data-form="item-stats"]');
  minus(view, 'DEX').click();
  plus(view, 'VIT').click();
  view.querySelector('[data-save="stats"]').click();
  await flush();
  assert.match(view.querySelector('.gst-why').textContent, /after the first message/);
  for (const message of ['Mara keeps this piece as it is: it is bound to them.', 'Gear in fights is not switched on.', 'This piece gives no points to move.']) {
    const [locked, ctx] = sheetOf(gearItem({ bound: true }), () => ({ ok: false, message }));
    locked.querySelector('[data-change="stats"]').click();
    await flush();
    assert.deepEqual(ctx.sent, [['inventory.edit', { stack: gearItem().stack, stats: {} }]], 'asks the engine, which refuses before reading the stats');
    const why = locked.querySelector('.gst-why');
    assert.equal(why.textContent, message);
    assert.equal(why.hasAttribute('hidden'), false);
    assert.equal(locked.querySelector('[data-form="item-stats"]'), null, 'no picker opens');
  }
});

test('a non-gear item has no Stats row', () => {
  installFakeDom();
  const use = bagFixture().items.find(i => i.kind === 'use');
  const [el] = sheetOf(use);
  assert.equal(el.querySelector('[data-change="stats"]'), null);
});
