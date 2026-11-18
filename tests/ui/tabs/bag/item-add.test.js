import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { addPayload } from '../../../../ui/tabs/bag/item-add.js';
import { makeCtx } from './helpers.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('addPayload needs a name and a whole count of at least 1, and leaves an empty note out', () => {
  assert.deepEqual(addPayload({ name: ' Rope ', kind: 'goods', qty: '2', note: '' }), { name: 'Rope', kind: 'goods', qty: 2 });
  assert.deepEqual(addPayload({ name: 'Lamp', kind: 'equipment', qty: '1', note: ' oil ' }), { name: 'Lamp', kind: 'equipment', qty: 1, note: 'oil' });
  for (const bad of [{ name: '  ' }, { name: 'Rope', qty: '0' }, { name: 'Rope', qty: '1.5' }, { name: 'Rope', qty: '' }]) assert.equal(addPayload(bad), null);
});

test('+ Add opens the add form in a sheet; Add sends inventory.add and closes it', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = bagTab(bagFixture(), ctx);
  tab.querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  assert.equal(ctx.sheets.length, 1);
  assert.equal(ctx.sheets[0][1], 'Add an item');
  const form = ctx.sheets[0][0];
  assert.equal(form.dataset.form, 'item-add');
  form.querySelector('input').value = 'Rope';
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['inventory.add', { name: 'Rope', kind: 'goods', qty: 1 }], ['close']]);
});

test('the add form keeps itself open and shows the engine\'s refusal, and a nameless Add says so without sending', async () => {
  installFakeDom();
  const ctx = makeCtx();
  ctx.port.command = (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve({ ok: false, message: 'Gear is not switched on.' }); };
  const tab = bagTab(bagFixture(), ctx);
  tab.querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  const form = ctx.sheets[0][0];
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent, []);
  assert.match(form.querySelector('.err').textContent, /name/);
  form.querySelector('input').value = 'Sword';
  form.querySelector('.save').click();
  await flush();
  assert.match(form.querySelector('.err').textContent, /Gear is not switched on/);
  assert.equal(ctx.sent.some(entry => entry[0] === 'close'), false);
});
