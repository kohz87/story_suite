// The Bag's own carry flow on a real host, as the forms send it: + Add a hand-made sack then Carries on the stack the add returns; a later Edit
// renames it and Carries lands on the stack the edit returns; Carry as bag hands it to a companion. Capacity and the Bag view follow; replay
// equals live after a rebuild, a reload and deleting the reply that held the add. And a mount the reader adds again after the story took it away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { validateInventory } from '../../../modules/inventory/index.js';
import { validateScene } from '../../../modules/scene/index.js';
import { selectBag } from '../../../ui/select/bag.js';
import { checkInvariants } from '../../suite/qa/helpers/oracle.js';

const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_wessel01', name: 'Wessel' }] } };
const MARA = 'ac_mara0001';
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const last = host => host.ctx.chat.length - 1;
const ok = async (host, name, payload) => { const out = await host.sdk.command(name, payload); assert.equal(out.ok, true, `${name}: ${out.message}`); return out; };
const capacity = (host, owner) => host.sdk.query('gear.view', { owner }).carry.capacity;
const bagItem = (host, name) => {
  const view = host.sdk.query('gear.view', { owner: 'party' });
  return selectBag({ rpg: true, items: host.sdk.query('inventory.items'), gear: view, carriers: view.carriers, pcId: 'you' }).items.find(item => item.name === name);
};
const snapshot = host => JSON.stringify([host.head().domains.inventory, host.head().domains.scene.mounts ?? null]);

async function fresh(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [ACTORS], settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
  t.after(() => host.close());
  await host.send('Hello.', reply('The road.', ['~ place Stray Oar | kind: inn', '+ item Rope']));
  return host;
}
function steady(host, label) {
  assert.deepEqual(validateInventory(host.head().domains.inventory), [], label);
  assert.deepEqual(validateScene(host.head().domains.scene), [], label);
  checkInvariants(host, label);
  const live = snapshot(host);
  host.store.rebuild();
  assert.equal(snapshot(host), live, `${label}: a rebuild equals live`);
}

test('+ Add then Carries, a rename then Carries on the new stack, Carry as bag to a companion; replay equals live; deleting the add', async t => {
  const host = await fresh(t);
  const base = capacity(host, 'party');
  await host.send('Market.', reply('A stall.', ['+ coin 2']));
  const added = last(host);
  const add = await ok(host, 'inventory.add', { name: 'Old Sack', kind: 'goods', qty: 1 });
  const stack = add.receipt.data.stacks[0];
  assert.ok(stack, 'the add returns its stack, as + Add reads it');
  await ok(host, 'inventory.carry', { stack, carry: 12 });
  assert.equal(capacity(host, 'party'), base + 12);
  assert.deepEqual(['carry', 'carryWhy', 'bagLike'].map(key => bagItem(host, 'Old Sack')[key]), [12, '', true]);
  await host.send('On.', reply('On.', ['+ coin 1']));
  const edit = await ok(host, 'inventory.edit', { stack, name: 'Big Sack' });
  const after = edit.receipt.data.stack;
  await ok(host, 'inventory.carry', { stack: after, carry: 20 });
  assert.equal(capacity(host, 'party'), base + 20);
  await ok(host, 'inventory.bag', { owner: MARA, stack: after });
  assert.equal(capacity(host, 'party'), base + 20, 'the sack\'s room moved to Mara: the party\'s total is the same');
  const [mara] = host.sdk.query('gear.view', {}).carry.people;
  assert.equal(mara.capacity, 30 + 20);
  assert.deepEqual(host.sdk.query('gear.view', { owner: MARA }).bagSlot, { stack: after, name: 'Big Sack', carry: 20 }, 'and is Mara\'s bag');
  const sack = bagItem(host, 'Big Sack');
  assert.deepEqual([sack.carry, sack.bagLike, sack.isBag, sack.wornBy], [20, true, true, MARA]);
  steady(host, 'live');
  const live = snapshot(host);
  const loaded = await createHost({ modules: [ACTORS], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.equal(snapshot(loaded), live, 'a reload equals live');
  // Deleting the reply that held the add: the later rename, Carries and bag choice find no sack; the state stays whole.
  await host.st.deleteMessage(added);
  assert.equal(host.sdk.query('inventory.items').some(item => /Sack/.test(item.name)), false);
  assert.equal(capacity(host, 'party'), base);
  steady(host, 'add deleted');
});

test('a mount the story took away and the reader added again: deleting the story\'s removal leaves one row, valid', async t => {
  const host = await fresh(t);
  await host.send('Yard.', reply('The yard.', ['+ mount Burr | kind: mule']));
  await host.send('Sold.', reply('Sold.', ['- mount Burr']));
  const sold = last(host);
  await host.send('Later.', reply('Later.', ['+ coin 1']));
  await ok(host, 'mounts.add', { name: 'Burr', kind: 'horse' });
  await host.st.deleteMessage(sold);
  const rows = host.sdk.query('mounts.list');
  assert.deepEqual(rows.map(row => [row.name, row.kind]), [['Burr', 'horse']], 'one Burr: the reader\'s add stands on the old key');
  steady(host, 'removal deleted');
});
