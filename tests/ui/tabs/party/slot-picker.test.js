import test from 'node:test';
import assert from 'node:assert/strict';
import { openSheet, slotSheet, SLOT_META } from '../../../../ui/tabs/party/slot-picker.js';
import { makeCtx, flush, commands, sheetEl } from './helpers.js';

test('openSheet adds one dialog, a back-stack entry, and closes by x, backdrop, Escape and a second close', () => {
  const ctx = makeCtx();
  const opener = globalThis.document.createElement('button');
  globalThis.document.body.appendChild(opener);
  opener.focus();
  const sheet = openSheet(ctx, { title: 'Title', subtitle: 'Sub' });
  assert.equal(sheetEl().querySelector('[role="dialog"]').getAttribute('aria-label'), 'Title');
  assert.equal(sheetEl().querySelector('.ps-s').textContent, 'Sub');
  assert.equal(ctx.backStack.hasLayer('sheet'), true);
  assert.equal(globalThis.document.activeElement.className, 'ps-x');
  sheet.subtitle('Later');
  assert.equal(sheetEl().querySelector('.ps-s').textContent, 'Later');
  sheetEl().querySelector('.ps-x').click();
  assert.equal(sheetEl(), null);
  assert.equal(ctx.backStack.hasLayer('sheet'), false);
  assert.equal(globalThis.document.activeElement, opener);
  assert.equal(sheet.close(), false);
  openSheet(ctx, { title: 'B' });
  sheetEl().click();
  assert.equal(sheetEl(), null);
  openSheet(ctx, { title: 'C' });
  ctx.backStack.handleKeydown({ key: 'Escape', preventDefault() {} });
  assert.equal(sheetEl(), null);
  const inner = openSheet(ctx, { title: 'D' });
  inner.body.click();
  assert.notEqual(sheetEl(), null);
  inner.close();
});

test('openSheet works without a back-stack or title and mounts in the suite root when there is one', () => {
  const ctx = makeCtx();
  const root = globalThis.document.createElement('div');
  root.className = 'su-root';
  globalThis.document.body.appendChild(root);
  const sheet = openSheet({});
  assert.equal(root.querySelector('.pty-ov') !== null, true);
  sheet.close();
  assert.equal(root.querySelector('.pty-ov'), null);
  void ctx;
});

test('SLOT_META names a glyph and two labels for all ten slots', () => {
  assert.deepEqual(Object.keys(SLOT_META), ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag']);
  for (const meta of Object.values(SLOT_META)) assert.equal(meta.length, 3);
  assert.throws(() => { SLOT_META.head = []; }, TypeError);
});

test('slot sheet for a worn slot shows the item, soak, condition, Unequip and matching Bag items', async () => {
  const ctx = makeCtx();
  const astra = ctx.party.members[0];
  slotSheet(astra, 'offhand', ctx);
  const text = sheetEl().textContent;
  assert.match(text, /Astra · Offhand/);
  assert.match(text, /Oak round shield/);
  assert.match(text, /Uncommon · worn by Astra/);
  assert.match(text, /Soak \+1/);
  assert.match(text, /Torn/);
  assert.match(text, /Nothing in the Bag fits this slot\./);
  sheetEl().querySelector('[data-unequip]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['inventory.unequip', { owner: 'astra', slot: 'offhand' }]]);
  assert.equal(sheetEl(), null);
});

test('slot sheet for an empty slot lists Bag items that fit and Equip sends item.equip', async () => {
  const ctx = makeCtx();
  const astra = ctx.party.members[0];
  slotSheet(astra, 'head', ctx);
  assert.match(sheetEl().querySelector('.ps-s').textContent, /Nothing worn here/);
  assert.equal(sheetEl().querySelector('[data-unequip]'), null);
  const rows = sheetEl().querySelectorAll('.ps-r');
  assert.deepEqual(rows.map(r => r.dataset.stack), ['steel-helm']);
  assert.match(rows[0].textContent, /Soak \+1 · Fine/);
  rows[0].querySelector('[data-equip]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['item.equip', { owner: 'astra', slot: 'head', stack: 'steel-helm' }]]);
  assert.equal(sheetEl(), null);
});

test('slot sheet filters by slot glyph, hides worn Bag items and offers Open Bag only with go()', () => {
  const ctx = makeCtx();
  const astra = ctx.party.members[0];
  slotSheet(astra, 'weapon', ctx);
  assert.deepEqual(sheetEl().querySelectorAll('.ps-r').map(r => r.dataset.stack), ['spare-dagger']);
  sheetEl().querySelector('[data-tabgo]').click();
  assert.deepEqual(ctx.went, ['bag']);
  assert.equal(sheetEl(), null);
  slotSheet(astra, 'accessory1', { ...ctx, go: undefined });
  assert.equal(sheetEl().querySelector('[data-tabgo]'), null);
  assert.match(sheetEl().textContent, /Nothing in the Bag fits this slot/);
  assert.equal(slotSheet(astra, 'nonsense', ctx), null);
});

test('slot sheet tolerates a missing bag view and a member without that slot', () => {
  const ctx = makeCtx();
  const sheet = slotSheet({ id: 'x', name: 'Xan', slots: [] }, 'cloak', { ...ctx, port: { view: () => null, command: async () => ({}) } });
  assert.match(sheetEl().textContent, /Nothing worn here/);
  assert.match(sheetEl().textContent, /Nothing in the Bag fits this slot/);
  sheet.close();
});
