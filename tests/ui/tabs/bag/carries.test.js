// The Bag's Carries (what an item adds to carrying, inventory.carry) in the item Edit and + Add forms, read-only with the engine's reason for a
// pack's item or a bound piece; and the item sheet's Carry as bag… (inventory.bag, a member picker with portraits) and Put down, a refusal
// staying in the sheet with its reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { carryChange } from '../../../../ui/tabs/bag/carry-field.js';
import { makeCtx } from './helpers.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const find = name => bagFixture().items.find(i => i.name === name);
const answering = (ctx, answer) => { ctx.port.command = (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve(answer(type, payload)); }; return ctx; };
const editOf = (item, ctx) => {
  const el = itemSheet(item, { ...ctx, rpg: true });
  el.querySelector('.btn2.edit').click();
  return el;
};
const carryInput = el => el.querySelector('input[data-field="carry"]');

test('carryChange: empty is 0, the same value is no change, 0 to 500 whole only', () => {
  assert.deepEqual(carryChange('', 0), { carry: null });
  assert.deepEqual(carryChange(' 12 ', 0), { carry: 12 });
  assert.deepEqual(carryChange('', 10), { carry: 0 });
  assert.deepEqual(carryChange('500', 0), { carry: 500 });
  for (const bad of ['501', '-1', '1.5', 'ten']) assert.match(carryChange(bad, 0).error, /whole number from 0 to 500/);
});

test('Edit: Carries on the reader\'s own item; a Carries-only change sends inventory.carry and closes', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const el = editOf(find('Rope, 50 ft'), ctx);
  assert.match(el.querySelector('label.ef[data-carry="own"]').textContent, /^Carries/);
  carryInput(el).value = '15';
  el.querySelector('.btn2.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.carry', { stack: 'rope-50-ft', carry: 15 }], ['close']]);
});

test('Edit: a rename and a Carries change send the edit first, then Carries on the stack the edit leaves', async () => {
  installFakeDom();
  const ctx = answering(makeCtx(), type => (type === 'inventory.edit' ? { ok: true, receipt: { data: { stack: 'it_new0001' } } } : { ok: true }));
  const el = editOf(find('Rope, 50 ft'), ctx);
  el.querySelector('.iedit input').value = 'Climbing rope';
  carryInput(el).value = '5';
  el.querySelector('.btn2.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.edit', { stack: 'rope-50-ft', name: 'Climbing rope' }], ['inventory.carry', { stack: 'it_new0001', carry: 5 }], ['close']]);
});

test('Edit: a bad value says the range without sending; the engine\'s refusal stays in the form', async () => {
  installFakeDom();
  const ctx = answering(makeCtx(), () => ({ ok: false, message: 'Only the reader can make this edit.' }));
  const el = editOf(find('Rope, 50 ft'), ctx);
  carryInput(el).value = '900';
  el.querySelector('.btn2.save').click();
  await flush();
  assert.deepEqual(ctx.sent, []);
  assert.match(el.querySelector('.err').textContent, /whole number from 0 to 500/);
  carryInput(el).value = '20';
  el.querySelector('.btn2.save').click();
  await flush();
  assert.match(el.querySelector('.err').textContent, /Only the reader/);
  assert.equal(ctx.sent.some(([type]) => type === 'close'), false);
});

test('Edit: a pack\'s item (or a bound piece) shows Carries read-only with the engine\'s reason, and sends nothing for it', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const el = editOf(find('Bolt of blue wool'), ctx);
  assert.equal(carryInput(el).hasAttribute('disabled'), true);
  assert.equal(el.querySelector('[data-why="carry"]').textContent, 'This item comes from a pack, which sets its own carry capacity.');
  carryInput(el).value = '30';
  el.querySelector('.btn2.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [], 'nothing changed: Cancel');
  const bound = editOf({ ...find('Rope, 50 ft'), carryWhy: 'Bound to Mara: Rope stays with them.' }, makeCtx());
  assert.equal(bound.querySelector('[data-why="carry"]').textContent, 'Bound to Mara: Rope stays with them.');
  // a slotted piece (a sword) has no Carries; Story-only (no gear row) neither
  assert.equal(carryInput(editOf(find('Spare dagger'), makeCtx())), null);
});

test('+ Add with gear on: Carries goes to the new item after the add; its refusal keeps the sheet open and says the item was added', async () => {
  installFakeDom();
  const bag = { ...bagFixture(), gear: { on: true, kit: false } };
  const add = async answer => {
    const ctx = answering(makeCtx(), answer);
    bagTab(bag, ctx).querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
    const form = ctx.sheets[0][0];
    form.querySelector('input').value = 'Old sack';
    carryInput(form).value = '8';
    form.querySelector('.save').click();
    await flush();
    return [ctx, form];
  };
  const [ok] = await add(type => (type === 'inventory.add' ? { ok: true, receipt: { data: { stacks: ['it_sack0001'] } } } : { ok: true }));
  assert.deepEqual(ok.sent, [['inventory.add', { name: 'Old sack', kind: 'goods', qty: 1 }], ['inventory.carry', { stack: 'it_sack0001', carry: 8 }], ['close']]);
  const [no, form] = await add(type => (type === 'inventory.add' ? { ok: true, receipt: { data: { stacks: ['it_sack0001'] } } } : { ok: false, message: 'Gear is off.' }));
  assert.equal(no.sent.some(([type]) => type === 'close'), false);
  assert.equal(form.querySelector('.err').textContent, 'Added without its Carries. Gear is off.');
  // gear off: no Carries field
  const ctx = makeCtx();
  bagTab(bagFixture(), ctx).querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  assert.equal(carryInput(ctx.sheets[0][0]), null);
});

test('Carry as bag…: a member picker with portraits sends inventory.bag (the main character\'s owner is party) and closes', async () => {
  installFakeDom();
  const ctx = { ...makeCtx(), pcId: 'astra', rpg: true };
  const el = itemSheet({ ...find('Rope, 50 ft'), name: 'Old sack', carry: 0, bagLike: true, isBag: false }, ctx);
  const labels = el.querySelectorAll('.brow .btn2').map(b => b.textContent);
  assert.deepEqual(labels, ['Carry as bag…', 'Drop']);
  assert.match(el.querySelector('.kv').textContent, /CarriesAdds no load yet \(Edit › Carries\)/);
  el.querySelectorAll('.brow .btn2')[0].click();
  assert.equal(el.querySelector('.secl').textContent, 'Carry as bag');
  const members = el.querySelectorAll('.pick .mb');
  assert.equal(members.length, 4);
  assert.ok(members[0].querySelector('.av, img, [data-portrait], span'), 'each member has a portrait');
  members[0].click();
  await flush();
  members[2].click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.bag', { owner: 'party', stack: 'rope-50-ft' }], ['close'], ['inventory.bag', { owner: 'rika', stack: 'rope-50-ft' }], ['close']]);
});

test('Carry as bag…: the engine\'s refusal stays in the sheet with its reason and no Edit item button', async () => {
  installFakeDom();
  const ctx = answering({ ...makeCtx(), rpg: true }, () => ({ ok: false, message: 'Rika cannot carry that much more.' }));
  const el = itemSheet({ ...find('Leather satchel'), wornBy: null, isBag: false, hand: true }, ctx);
  el.querySelectorAll('.brow .btn2').find(b => b.textContent === 'Carry as bag…').click();
  el.querySelectorAll('.pick .mb')[2].click();
  await flush();
  assert.equal(el.querySelector('.pick-wrap .err').textContent, 'Rika cannot carry that much more.');
  assert.equal(el.querySelector('.pick-wrap .brow'), null);
  assert.equal(ctx.sent.some(([type]) => type === 'close'), false);
});

test('a carried bag: Put down frees it (inventory.bag with no stack); Carries shows what it adds', async () => {
  installFakeDom();
  const ctx = { ...makeCtx(), pcId: 'astra', rpg: true };
  const el = itemSheet(find('Quiver bag'), ctx);
  assert.deepEqual(el.querySelectorAll('.brow .btn2').map(b => b.textContent), ['Put down', 'Give to…', 'Carry as bag…', 'Drop']);
  assert.match(el.querySelector('.kv').textContent, /Carries\+5 load/);
  el.querySelector('.btn2.pri').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.bag', { owner: 'rika', stack: null }], ['close']]);
});
