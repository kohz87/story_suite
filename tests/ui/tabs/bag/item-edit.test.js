import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { itemPatch } from '../../../../ui/tabs/bag/item-edit.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { makeCtx } from './helpers.js';

const find = (name, rpg = true) => bagFixture({ rpg }).items.find(i => i.name === name);
const open = (item, rpg, command) => {
  const ctx = { ...makeCtx(), rpg };
  if (command) ctx.port = { command: (type, payload) => { ctx.sent.push([type, payload]); return command(type, payload); } };
  const el = itemSheet(item, ctx);
  el.querySelector('.btn2.edit').click();
  return [el, ctx];
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const set = (el, selector, value) => { el.querySelector(selector).value = value; };

test('Edit is in the header and opens a form for name, count and note (RPG off: no gear fields)', () => {
  installFakeDom();
  const el = itemSheet(find('Salted fish', false), { ...makeCtx(), rpg: false });
  assert.equal(el.querySelector('.dh .bhact .btn2.edit').textContent, 'Edit');
  el.querySelector('.btn2.edit').click();
  const labels = el.querySelectorAll('.iedit .ef').map(l => l.childNodes[0].textContent ?? l.textContent.slice(0, 5));
  assert.equal(el.querySelectorAll('.iedit .ef').length, 3, `Name, Count, Your note only (${labels})`);
  assert.equal(el.querySelector('.iedit select'), null);
});

test('RPG on: a hand-made piece adds Rarity and Slot; a story piece does not', () => {
  installFakeDom();
  const [hand] = open(find('Spare dagger'), true);
  assert.equal(hand.querySelectorAll('.iedit select').length, 2);
  const [story] = open(find('Steel longsword'), true);
  assert.equal(story.querySelectorAll('.iedit select').length, 0);
});

test('Save sends inventory.edit with only the changed fields, through the port, then closes', async () => {
  installFakeDom();
  const [el, ctx] = open(find('Healing draught'), true, () => Promise.resolve({ ok: true }));
  const inputs = el.querySelectorAll('.iedit input');
  inputs[0].value = ' Strong draught ';
  inputs[1].value = '5';
  set(el, '.iedit textarea', 'Kept for Astra');
  el.querySelector('.btn2.save').click();
  await tick();
  assert.deepEqual(ctx.sent, [['inventory.edit', { stack: 'healing-draught', name: 'Strong draught', qty: 5, group: true, note: 'Kept for Astra' }], ['close']]);
});

test('RPG on: Save sends rarity and slot of a hand-made piece', async () => {
  installFakeDom();
  const [el, ctx] = open(find('Spare dagger'), true, () => Promise.resolve({ ok: true }));
  const [rarity, slot] = el.querySelectorAll('.iedit select');
  rarity.value = 'rare';
  slot.value = 'off-hand';
  el.querySelector('.btn2.save').click();
  await tick();
  assert.deepEqual(ctx.sent[0], ['inventory.edit', { stack: 'spare-dagger', rarity: 'rare', slot: 'off-hand' }]);
});

test('a refusal from the command shows inline and the form stays open', async () => {
  installFakeDom();
  const port = createSbPort({ sdk: { command: async () => ({ ok: false, code: 'REFUSED', message: 'Brann’s Hob boots keep their name and count.' }) } });
  const ctx = { ...makeCtx(), rpg: true, port };
  const el = itemSheet(find('Healing draught'), ctx);
  el.querySelector('.btn2.edit').click();
  el.querySelector('.iedit input').value = 'Cheap draught';
  el.querySelector('.btn2.save').click();
  await tick();
  const err = el.querySelector('.iedit .err');
  assert.equal(err.textContent, 'Brann’s Hob boots keep their name and count.');
  assert.equal(err.hasAttribute('hidden'), false);
  assert.ok(el.querySelector('.iedit'), 'still editing');
  assert.deepEqual(ctx.sent, [], 'nothing was closed');
});

test('Cancel changes nothing: no command, and the item view comes back', () => {
  installFakeDom();
  const [el, ctx] = open(find('Healing draught'), true);
  el.querySelector('.iedit input').value = 'Changed';
  el.querySelector('.btn2.cancel').click();
  assert.deepEqual(ctx.sent, []);
  assert.equal(el.querySelector('.iedit'), null);
  assert.equal(el.querySelector('.dn').textContent, 'Healing draught');
});

test('Save with nothing changed sends nothing; patch drops blank names and bad counts', () => {
  const item = { stack: 's', name: 'Rope', qty: 2, note: '', kind: 'goods' };
  assert.equal(itemPatch(item, { name: ' Rope ', qty: '2', note: '' }), null);
  assert.deepEqual(itemPatch(item, { name: '', qty: '0', note: 'x' }), { stack: 's', note: 'x' });
  assert.deepEqual(itemPatch(item, { name: 'Rope', qty: '3', note: '' }), { stack: 's', qty: 3, group: true });
});
