// The Party paper-doll's Mount and Bag sheets (ui/tabs/party/carrier-picker.js): the lists, the reasons a row cannot be chosen,
// the commands each choice sends (mounts.ride, inventory.bag), None, and a refusal from the engine kept in the sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierSheet } from '../../../../ui/tabs/party/carrier-picker.js';
import { slotsDoll } from '../../../../ui/tabs/party/slots.js';
import { makeCtx, flush, commands, sheetEl } from './helpers.js';

const rows = () => sheetEl().querySelectorAll('.ps-r');
const rowText = row => row.textContent;

test('the Mount sheet: what the member rides, every mount with kind, pace and riders, and why one cannot be ridden', async () => {
  const ctx = makeCtx();
  const astra = ctx.party.members[0];
  carrierSheet(astra, 'mount', ctx);
  assert.match(sheetEl().querySelector('[role="dialog"]').getAttribute('aria-label'), /Astra · Mount/);
  assert.match(sheetEl().querySelector('.ps-i').textContent, /Dappled mare.*horse · 35 km\/day/);
  assert.match(sheetEl().querySelector('.ps-kv').textContent, /Pace35 km\/dayCarries\+40 load/);
  assert.deepEqual(rows().map(row => row.dataset.mount), ['Dappled mare', 'Grey pony', 'Hired mules', 'Old Burr']);
  assert.match(rowText(rows()[0]), /ridden by Astra.*Riding/);
  assert.match(rowText(rows()[1]), /Carries Rika already\./);
  assert.equal(rows()[1].querySelector('[data-ride]').hasAttribute('disabled'), true);
  assert.match(rowText(rows()[3]), /Not with the party: stabled at the Stray Oar\./);
  assert.equal(rows()[3].querySelector('[data-ride]').hasAttribute('disabled'), true);
  rows()[2].querySelector('[data-ride]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['mounts.ride', { who: 'Astra', mount: 'Hired mules' }]]);
  assert.equal(sheetEl(), null, 'a choice closes the sheet');
  carrierSheet(astra, 'mount', ctx);
  sheetEl().querySelector('[data-none="mount"]').click();
  await flush();
  assert.deepEqual(commands(ctx.port).at(-1), ['mounts.ride', { who: 'Astra', mount: null }]);
});

test('the Mount sheet with no mounts, and for a member who walks', () => {
  const ctx = makeCtx();
  const brann = ctx.party.members[1];
  carrierSheet(brann, 'mount', ctx);
  assert.equal(sheetEl().querySelector('.ps-s').textContent, 'Walks: rides no mount');
  assert.equal(sheetEl().querySelector('[data-none]'), null, 'nothing to free');
  sheetEl().querySelector('.ps-x').click();
  const bare = makeCtx();
  bare.port = { ...bare.port, view: tab => (tab === 'party' ? { ...bare.party, carriers: { mounts: [], packs: [] } } : null) };
  carrierSheet(bare.party.members[1], 'mount', bare);
  assert.match(sheetEl().querySelector('[data-why="none"]').textContent, /The party has no mounts/);
});

test('the Bag sheet: the carried bag with its load, the party\'s other bags with whose they are, a bound one refused', async () => {
  const ctx = makeCtx();
  const astra = ctx.party.members[0];
  carrierSheet(astra, 'bag', ctx);
  assert.match(sheetEl().querySelector('.ps-i').textContent, /Leather satchel.*Carried as a bag/);
  assert.match(sheetEl().querySelector('.ps-kv').textContent, /Adds\+10 load/);
  assert.deepEqual(rows().map(row => row.dataset.pack), ['quiver-bag', 'canvas-pack', 'oath-pouch'], 'her own bag is the one shown above');
  assert.match(rowText(rows()[0]), /\+4 load · Rika's bag/);
  assert.match(rowText(rows()[1]), /\+15 load · held/);
  assert.match(rowText(rows()[2]), /Adds no load yet \(Edit › Carry\) · with Torka.*Bound to Torka: it stays with them\./);
  assert.equal(rows()[2].querySelector('[data-carry]').hasAttribute('disabled'), true);
  rows()[1].querySelector('[data-carry]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['inventory.bag', { owner: 'party', stack: 'canvas-pack' }]], 'the main character\'s things are the party\'s');
  const rika = ctx.party.members[2];
  carrierSheet(rika, 'bag', ctx);
  sheetEl().querySelector('[data-none="bag"]').click();
  await flush();
  assert.deepEqual(commands(ctx.port).at(-1), ['inventory.bag', { owner: 'rika', stack: null }]);
});

test('an engine refusal stays in the sheet with its reason', async () => {
  const ctx = makeCtx();
  ctx.port = { ...ctx.port, command: async () => ({ ok: false, message: 'Rika cannot carry that: 30 of 28 carried.' }) };
  carrierSheet(ctx.party.members[2], 'bag', ctx);
  rows()[1].querySelector('[data-carry]').click();
  await flush();
  assert.notEqual(sheetEl(), null, 'the sheet stays open');
  const note = sheetEl().querySelector('[data-refused]');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'Rika cannot carry that: 30 of 28 carried.');
});

test('tapping the doll\'s Mount and Bag slots opens these sheets, not the gear slot sheet', () => {
  const ctx = makeCtx();
  const doll = slotsDoll(ctx.party.members[0], ctx);
  doll.querySelector('[data-slot="bag"]').click();
  assert.match(sheetEl().querySelector('.ps-sec').textContent, /The party's bags/);
  sheetEl().querySelector('.ps-x').click();
  doll.querySelector('[data-slot="mount"]').click();
  assert.match(sheetEl().querySelector('.ps-sec').textContent, /The party's mounts/);
});
