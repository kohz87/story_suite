// selectBag's carry fields from a real host: each item's Carries and the engine's reason it is read-only (gear.view rows' carry / carryWhy),
// which items can be carried as a bag and which one is (carriers.packs), and Transport's + Add switch and the Edit form's mount values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { selectBag } from '../../../ui/select/bag.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../ui/contract/bag.js';

// (the selector leaves its known gaps null: isNew, desc, and weight, soak and pace while their switches are off)
const shapeErrors = bag => checkShape(bag, BAG_SHAPE).filter(error => !/\.(isNew|desc|weight|soak): expected \w+, got null$|^pace: expected object, got null$/.test(error));
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const read = host => {
  const view = host.sdk.query('gear.view', { owner: 'party' });
  return selectBag({ rpg: true, items: host.sdk.query('inventory.items'), gear: view, carriers: view?.carriers, mounts: host.sdk.query('mounts.list'), pace: host.sdk.query('mounts.pace'), pcId: 'you' });
};

test('Carries, its reason, bag-like and carried-as-bag; a slotted piece has no Carries; the mounts\' Edit values and + Add', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
  t.after(() => host.close());
  await host.send('Hello.', reply('The road.', ['+ item Old Sack', '+ item Rope', '+ item Iron Sword | kind: equipment | slot: weapon', '+ mount Burr | kind: mule']));
  const sack = host.sdk.query('inventory.items').find(item => item.name === 'Old Sack').stack;
  assert.equal((await host.sdk.command('inventory.carry', { stack: sack, carry: 12 })).ok, true);
  assert.equal((await host.sdk.command('mounts.edit', { mount: 'Burr', carry: 55 })).ok, true);
  assert.equal((await host.sdk.command('inventory.bag', { owner: 'party', stack: sack })).ok, true);
  const bag = read(host);
  assert.deepEqual(shapeErrors(bag), []);
  const item = name => bag.items.find(entry => entry.name === name);
  assert.deepEqual([item('Old Sack').carry, item('Old Sack').carryWhy, item('Old Sack').bagLike, item('Old Sack').isBag], [12, '', true, true]);
  assert.deepEqual([item('Rope').carry, item('Rope').carryWhy, item('Rope').bagLike], [0, '', undefined], 'any loose item may be given Carries; Rope is no bag yet');
  assert.equal(item('Iron Sword').carry, undefined, 'a slotted piece is never a bag');
  assert.equal(bag.assets.canAdd, true);
  assert.deepEqual(['count', 'pace', 'carry'].map(key => bag.assets.transport[0][key]), [1, 25, 55]);
});

test('gear off: no Carries; the mounts switch off: no + Add', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ settings: { features: { 'story-block.mounts': false } } });
  t.after(() => host.close());
  await host.send('Hello.', reply('The road.', ['+ item Old Sack']));
  const bag = read(host);
  assert.equal(bag.items[0].carry, undefined);
  assert.equal(bag.assets.canAdd, false);
  assert.deepEqual(shapeErrors(bag), []);
});
