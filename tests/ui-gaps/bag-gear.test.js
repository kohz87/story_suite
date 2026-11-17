// Bag data (G6): a real host with Gear, Mounts and a denominated currency gives the Bag its load breakdown, mount riders, the mount link and a denominated purse; a swipe, a middle delete, a rewind, a Re-read and a reload agree with live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { BAG_SHAPE } from '../../ui/contract/bag.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { selectBag } from '../../ui/select/bag.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const settings = { features: { 'story-block.gear': true, 'story-block.rpg': true, 'story-block.mounts': true }, modules: { 'story-block': { currency: 'penny', currencyPlural: 'pennies', coins: [{ name: 'penny', plural: 'pennies', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }] } } };
const bagOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk) }).view('bag');

async function fresh(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ settings });
  t.after(() => host.close());
  await host.send('Hello.', 'The road.');
  return host;
}

test('mount riders, the mount link, load chips and a denominated purse reach the Bag and fit BAG_SHAPE', async t => {
  const host = await fresh(t);
  await host.send('Go.', reply('Set out.', ['+ coin 35', '+ mount Grey Mare | kind: horse | pace: 35 | where: ridden by Wessel and Tam', '+ mount Old Cart | kind: cart | where: parked at the Stray Oar']));
  const vm = bagOf(host);
  assert.notEqual(vm, null);
  assert.deepEqual(checkShape(vm, BAG_SHAPE), []);
  const mare = vm.assets.transport.find(a => a.name === 'Grey Mare');
  assert.deepEqual(mare.riders, ['Wessel', 'Tam']);
  assert.equal(mare.withParty, true);
  assert.equal(mare.seats, null);
  assert.ok(mare.meta.some(m => /^\+\d+ load$/.test(m)), 'the mount link: what it adds to the load');
  const cart = vm.assets.transport.find(a => a.name === 'Old Cart');
  assert.equal(cart.withParty, false);
  assert.deepEqual(cart.riders, []);
  assert.equal(vm.purse.words, '3 silver 5 pennies');
  assert.equal(vm.purse.coins, null);
  assert.equal(vm.load, null, 'no main character: no load card (as before)');
  // With a main character the selector reads gear.view as asked for them: the real answer, fed in by hand.
  const q = (name, args = {}) => host.sdk.query(name, args);
  const full = selectBag({ rpg: true, items: q('inventory.items'), gear: q('gear.view', {}), wallet: q('inventory.wallet'), currency: q('inventory.currency'), mounts: q('mounts.list'), pace: q('mounts.pace'), carriers: q('gear.view', {}).carriers, pcId: 'party' });
  assert.deepEqual(checkShape(full, BAG_SHAPE), []);
  assert.ok(full.load.breakdown.length >= 3);
  assert.ok(full.load.breakdown.some(b => b.label === 'Grey Mare' && !b.dim));
  assert.ok(full.load.breakdown.some(b => b.label === 'Old Cart' && b.dim && /not with you/.test(b.text)));
});

test('replay equals live: swipe, middle delete, rewind, Re-read (edited too) and reload', async t => {
  const host = await fresh(t);
  await host.send('Go.', reply('Set out.', ['+ mount Grey Mare | kind: horse | where: ridden by Wessel']));
  await host.send('Buy.', reply('Paid.', ['+ coin 25']));
  await host.send('More.', reply('Later.', ['+ coin 3']));
  const view = h => JSON.stringify(bagOf(h));
  const live = view(host);
  host.store.rebuild();
  assert.equal(view(host), live, 'rebuild');
  const loaded = await createHost({ settings, st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.equal(view(loaded), live, 'reload');
  const at = host.ctx.chat.length - 1;
  assert.equal((await host.turn.reread(at)).ok, true);
  assert.equal(view(host), live, 'Re-read');
  await host.swipe(reply('Nothing.', ['+ coin 1']));
  assert.match(bagOf(host).purse.words, /^3 silver 1 penny$|^2 silver 6 pennies$/);
  await host.st.deleteMessage(host.ctx.chat.findIndex(m => /Paid/.test(m.mes)));
  assert.deepEqual(bagOf(host).assets.transport.map(a => a.riders), [['Wessel']]);
  assert.match(bagOf(host).purse.words, /pennies|penny/);
  assert.deepEqual(host.store.problems(), []);
  const after = view(host);
  host.store.rebuild();
  assert.equal(view(host), after);
});

test('a mount row with no riders, no carriers and a plain currency keeps today\'s numbers (the selector, fed old answers)', () => {
  const vm = selectBag({ rpg: false, items: [], wallet: { coin: 5 }, currency: { name: 'mark', plural: 'marks' }, mounts: [{ name: 'Burr', kind: 'mule', count: 1, pace: 25, condition: '', where: '' }], gear: { carry: { load: 3, capacity: 30, level: 'normal' } } });
  assert.equal(vm.purse.words, '5 marks');
  assert.deepEqual(vm.load.breakdown, []);
  assert.deepEqual(vm.assets.transport[0].riders, []);
  assert.equal(vm.assets.transport[0].withParty, true);
  assert.deepEqual(vm.assets.transport[0].meta, ['mule', '25 km/day']);
});

test('base display shows the smallest unit', () => {
  const vm = selectBag({ items: [], wallet: { coin: 35 }, currency: { name: 'penny', plural: 'pennies', display: 'base', coins: [{ name: 'penny', plural: 'pennies', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }] } });
  assert.equal(vm.purse.words, '35 pennies');
});
