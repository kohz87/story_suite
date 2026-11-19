import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../../ui/contract/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { makeCtx } from './helpers.js';

const find = (name, rpg = true) => bagFixture({ rpg }).items.find(i => i.name === name);
const sheet = (item, rpg = true) => { const ctx = { ...makeCtx(), rpg }; return [itemSheet(item, ctx), ctx]; };
const labels = el => el.querySelectorAll('.brow .btn2').map(b => b.textContent);

test('fixture variants match the Bag shape', () => {
  for (const o of [{}, { rpg: false }, { over: true }]) assert.deepEqual(checkShape(bagFixture(o), BAG_SHAPE), []);
});

test('worn gear: Take off and Give to, Worn by, Wear, bonus and weight rows', () => {
  installFakeDom();
  const [el] = sheet(find('Oak round shield'));
  assert.deepEqual(labels(el), ['Take off', 'Give to…', 'Drop']);
  const kv = el.querySelector('.kv').textContent;
  assert.match(kv, /Worn byAstra/);
  assert.match(kv, /Bonus\+1 soak/);
  assert.match(kv, /WearTorn/);
  assert.match(kv, /Weight4 load/);
  assert.match(el.querySelector('.chips').textContent, /Uncommon.*Gear · Offhand/);
  assert.equal(el.querySelector('.wbar').classList.contains('w2'), true);
});

test('unworn gear offers Wear on; picking a member sends item.equip and closes', async () => {
  installFakeDom();
  const [el, ctx] = sheet(find('Spare dagger'));
  assert.deepEqual(labels(el), ['Wear on…', 'Drop']);
  el.querySelector('.btn2.pri').click();
  assert.equal(el.querySelectorAll('.pick .mb').length, 4);
  assert.equal(el.querySelector('.secl').textContent, 'Wear on');
  el.querySelectorAll('.pick .mb')[1].click();
  await new Promise(r => setTimeout(r, 0));
  // (the command reads `owner`; `transfer` hands the piece to them first, whoever has it now)
  assert.deepEqual(ctx.sent, [['item.equip', { stack: 'spare-dagger', owner: 'brann', transfer: true }], ['close']]);
});

test('Take off, Give to and Drop send the unequip, transfer and drop commands', () => {
  installFakeDom();
  const [el, ctx] = sheet(find('Chain shirt'));
  el.querySelector('.btn2.pri').click();
  el.querySelector('.btn2.dng').click();
  el.querySelectorAll('.brow .btn2')[1].click();
  el.querySelectorAll('.pick .mb')[2].click();
  assert.deepEqual(ctx.sent, [
    ['inventory.unequip', { stack: 'chain-shirt' }], ['close'],
    ['inventory.drop', { stack: 'chain-shirt' }], ['close'],
    ['inventory.transfer', { stack: 'chain-shirt', to: 'rika' }], ['close'],
  ]);
});

test('use items offer Use on; stacks show total load; goods have no equip action', () => {
  installFakeDom();
  const [el, ctx] = sheet(find('Healing draught'));
  assert.deepEqual(labels(el), ['Use on…', 'Drop']);
  assert.match(el.querySelector('.kv').textContent, /3 load · 1 each × 3/);
  el.querySelector('.btn2.pri').click();
  el.querySelectorAll('.pick .mb')[0].click();
  assert.deepEqual(ctx.sent[0], ['item.use', { stack: 'healing-draught', member: 'astra' }]);
  assert.deepEqual(labels(sheet(find('Rope, 50 ft'))[0]), ['Drop']);
  assert.match(sheet(find('Sealed letter'))[0].querySelector('.kv').textContent, /WeightNo weight/);
});

test('Story-only hides rarity, bonus, wear and weight rows', () => {
  installFakeDom();
  const [el] = sheet(find('Oak round shield', false), false);
  const kv = el.querySelector('.kv').textContent;
  assert.equal(/Bonus|Wear[^b]|Weight/.test(kv.replace('Worn by', '')), false);
  assert.equal(el.querySelector('.chips').textContent.includes('Uncommon'), false);
  assert.match(kv, /Worth here/);
});

test('bag-slot items label the slot Bag; no port or close is tolerated', () => {
  installFakeDom();
  assert.match(itemSheet(find('Leather satchel'), { rpg: true }).querySelector('.chips').textContent, /Gear · Bag/);
  const el = itemSheet(find('Antidote'), {});
  el.querySelector('.btn2.dng').click();
  assert.equal(el.querySelector('.pick-wrap').children.length, 0);
});

test('the main character is the inventory\'s `party`: Wear on and Give to name that owner for them', () => {
  installFakeDom();
  const ctx = { ...makeCtx(), rpg: true, pcId: 'astra' };
  const el = itemSheet(find('Spare dagger'), ctx);
  el.querySelector('.btn2.pri').click();
  el.querySelector('.pick .mb').click();
  assert.deepEqual(ctx.sent[0], ['item.equip', { stack: 'spare-dagger', owner: 'party', transfer: true }]);
  const worn = itemSheet(find('Chain shirt'), ctx);
  worn.querySelectorAll('.brow .btn2')[1].click();
  worn.querySelector('.pick .mb').click();
  assert.deepEqual(ctx.sent.find(([t]) => t === 'inventory.transfer'), ['inventory.transfer', { stack: 'chain-shirt', to: 'party' }]);
});

test('a piece with a stat bonus shows it on the sheet', () => {
  installFakeDom();
  const [el] = sheet({ ...find('Spare dagger'), bonus: '+1 STR +1 DEX' });
  assert.match(el.querySelector('.kv').textContent, /Stats\+1 STR \+1 DEX/);
  assert.match(sheet(find('Spare dagger'))[0].querySelector('.kv').textContent, /StatsNoneChange/, 'a gear piece with no points still has the row and its Change');
});
