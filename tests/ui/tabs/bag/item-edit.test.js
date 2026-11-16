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

test('Rarity prefills the real rarity and Slot keeps an unusual stored slot, so a note-only Save sends neither', async () => {
  installFakeDom();
  const item = { ...find('Spare dagger'), rarity: 'epic', realRarity: 'legendary', slot: 'shield', hand: true, kind: 'gear' };
  const [el, ctx] = open(item, true, () => Promise.resolve({ ok: true }));
  const [rarity, slot] = el.querySelectorAll('.iedit select');
  assert.equal(rarity.value, 'legendary');
  assert.equal(slot.value, 'shield');
  set(el, '.iedit textarea', 'a note');
  el.querySelector('.btn2.save').click();
  await tick();
  assert.deepEqual(ctx.sent[0], ['inventory.edit', { stack: item.stack, note: 'a note' }]);
});

test('Save is disabled while the command is in flight and sends once', async () => {
  installFakeDom();
  let release;
  const [el, ctx] = open(find('Healing draught'), true, () => new Promise(resolve => { release = resolve; }));
  set(el, '.iedit textarea', 'x');
  const save = el.querySelector('.btn2.save');
  save.click();
  await tick();
  assert.equal(save.disabled, true);
  save.click();
  await tick();
  assert.equal(ctx.sent.filter(([type]) => type === 'inventory.edit').length, 1);
  release({ ok: false, message: 'no' });
  await tick();
  assert.equal(save.disabled, false);
});

const labels = el => el.querySelectorAll('.iedit .ef').map(l => l.textContent.slice(0, 20));

test('RPG on: every item shows Weight each and armour shows Soak (up to its slot\'s cap); RPG off shows neither', () => {
  installFakeDom();
  const [shield] = open(find('Tower shield'), true);
  assert.equal(shield.querySelectorAll('.iedit .ef').length, 5, `Name, Count, Your note, Weight each, Soak: ${labels(shield)}`);
  const [weight, soak] = shield.querySelectorAll('.iedit input[type="number"]').slice(1);
  assert.deepEqual([weight.value, soak.value, soak.getAttribute('max')], ['6', '2', '2']);
  const [sword] = open(find('Steel longsword'), true);
  assert.equal(sword.querySelectorAll('.iedit .ef').length, 4, 'a weapon has a weight and no soak');
  const [draught] = open(find('Healing draught'), true);
  assert.equal(draught.querySelectorAll('.iedit .ef').length, 4, 'a potion has a weight and no soak');
  const [off] = open(find('Tower shield', false), false);
  assert.equal(off.querySelectorAll('.iedit .ef').length, 3, 'RPG off: Name, Count, Your note only');
});

test('Save sends the changed weight and soak, the way the command takes them, with nothing else; the same values send nothing', async () => {
  installFakeDom();
  const [el, ctx] = open(find('Tower shield'), true, () => Promise.resolve({ ok: true }));
  const [, weight, soak] = el.querySelectorAll('.iedit input[type="number"]');
  weight.value = '9';
  soak.value = '1';
  el.querySelector('.btn2.save').click();
  await tick();
  assert.deepEqual(ctx.sent[0], ['inventory.edit', { stack: 'tower-shield', weight: 9, soak: 1 }]);
  const item = find('Tower shield');
  assert.equal(itemPatch(item, { name: item.name, qty: '1', note: '', weight: '6', soak: '2' }, true), null);
  assert.deepEqual(itemPatch(item, { name: item.name, qty: '1', note: '', weight: '-1', soak: 'x' }, true), null, 'a bad number sends nothing');
  assert.deepEqual(itemPatch(item, { name: item.name, qty: '1', note: '', weight: '0' }, true), { stack: item.stack, weight: 0 }, 'a weight of 0 is a change');
  assert.deepEqual(itemPatch(item, { name: item.name, qty: '1', note: '', weight: '9', soak: '1' }, false), null, 'RPG off: not sent');
});

test('the engine\'s refusal of a soak above the cap shows inline', async () => {
  installFakeDom();
  const [el] = open(find('Tower shield'), true, () => Promise.resolve({ ok: false, message: 'Tower shield can soak at most 2 here.' }));
  el.querySelectorAll('.iedit input[type="number"]')[2].value = '5';
  el.querySelector('.btn2.save').click();
  await tick();
  assert.equal(el.querySelector('.iedit .err').textContent, 'Tower shield can soak at most 2 here.');
});
