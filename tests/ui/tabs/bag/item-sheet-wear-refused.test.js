import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { itemSheet } from '../../../../ui/tabs/bag/item-sheet.js';
import { makeCtx } from './helpers.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const refusing = message => { const ctx = { ...makeCtx(), rpg: true }; ctx.port = { command: (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve(type === 'item.equip' ? { ok: false, message } : { ok: true }); } }; return ctx; };
const gear = extra => ({ ...bagFixture({ rpg: true }).items.find(i => i.name === 'Spare dagger'), ...extra });

test('a refused Wear keeps the sheet open with the reason; a hand-made piece gets Edit item, which opens Edit with Slot focused', async () => {
  installFakeDom();
  const ctx = refusing('Choose a slot for Bag: its name does not say where it is worn.');
  const el = itemSheet(gear({ hand: true, slot: '' }), ctx);
  el.querySelector('.btn2.pri').click();
  el.querySelectorAll('.pick .mb')[0].click();
  await tick();
  assert.equal(ctx.sent.some(([t]) => t === 'close'), false, 'the sheet stays open');
  assert.match(el.querySelector('.pick-wrap .fine.err').textContent, /Choose a slot for Bag/);
  const editBtn = el.querySelectorAll('.btn2').find(b => b.textContent === 'Edit item');
  assert.ok(editBtn, 'Edit item is offered');
  editBtn.click();
  assert.ok(el.querySelector('[data-field="slot"]'), 'the Edit form shows the Slot field');
});

test('a refused Wear on a piece the reader cannot edit shows the reason only', async () => {
  installFakeDom();
  const ctx = refusing('Old map is not equipment, so it cannot be put on.');
  const el = itemSheet(gear({ hand: false }), ctx);
  el.querySelector('.btn2.pri').click();
  el.querySelectorAll('.pick .mb')[0].click();
  await tick();
  assert.match(el.querySelector('.pick-wrap .fine.err').textContent, /not equipment/);
  assert.equal(el.querySelectorAll('.btn2').some(b => b.textContent === 'Edit item'), false);
});
