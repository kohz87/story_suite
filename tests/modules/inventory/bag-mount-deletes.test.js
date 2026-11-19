// The Mount and Bag slots (inventory.bag, mounts.ride) when a reply they depend on is deleted: the reply that gave the bag, the reply
// that freed one between two choices, the reply that added the mount ridden or the one ridden before. The state stays valid, the
// oracle's invariants hold, a rebuild equals live. And the real path: gear.view through gearOf and selectParty fills the doll's two slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { validateInventory } from '../../../modules/inventory/index.js';
import { validateScene } from '../../../modules/scene/index.js';
import { checkInvariants } from '../../suite/qa/helpers/oracle.js';
import { gearOf } from '../../../ui/select/gather.js';
import { selectParty } from '../../../ui/select/party.js';

const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_wessel01', name: 'Wessel' }] } };
const MARA = 'ac_mara0001';
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const last = host => host.ctx.chat.length - 1;
const stackOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name)?.stack;
const bags = host => host.sdk.query('inventory.items').filter(item => item.equipped === 'bag').map(item => [item.name, item.owner]).sort();
const wheres = host => host.sdk.query('mounts.list').map(row => [row.name, row.where]);
const ok = async (host, name, payload) => { const out = await host.sdk.command(name, payload); assert.equal(out.ok, true, out.message); };

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
    const live = JSON.stringify([host.head().domains.inventory, host.head().domains.scene.mounts ?? null]);
    host.store.rebuild();
    assert.equal(JSON.stringify([host.head().domains.inventory, host.head().domains.scene.mounts ?? null]), live, `${label}: a rebuild equals live`);
}

test('deleting the reply that gave the bag: the later choice finds nothing to carry and the state stays whole', async t => {
    const host = await fresh(t);
    await host.send('A sack.', reply('A sack.', ['+ item Old Sack']));
    const gave = last(host);
    await host.send('On.', reply('On.', ['+ coin 1']));
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Old Sack') });
    assert.deepEqual(bags(host), [['Old Sack', MARA]]);
    await host.st.deleteMessage(gave);
    assert.deepEqual(bags(host), []);
    assert.equal(stackOf(host, 'Old Sack'), undefined);
    steady(host, 'after deleting the bag\'s reply');
});

// (as item.equip into a slot freed on the deleted reply: replay applies each reply's changes, and two bags for one member do not fit)
test('bag X, then None, then bag Y on three replies; deleting the None keeps X, and the later choice is a Problem that says why', async t => {
    const host = await fresh(t);
    await host.send('Bags.', reply('Bags.', ['+ item Old Sack', '+ item Leather Satchel']));
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Old Sack') });
    await host.send('A.', reply('A.', ['+ coin 1']));
    const freed = last(host);
    await ok(host, 'inventory.bag', { owner: MARA, stack: null });
    await host.send('B.', reply('B.', ['+ coin 1']));
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Leather Satchel') });
    assert.deepEqual(bags(host), [['Leather Satchel', MARA]]);
    await host.st.deleteMessage(freed);
    assert.deepEqual(bags(host), [['Old Sack', MARA]], 'one bag each: the sack she still carries');
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Leather Satchel').owner, 'party', 'the satchel stays in the party\'s bag');
    assert.deepEqual(host.store.problems().map(problem => problem.why ?? problem.message).filter(Boolean).map(why => /same slot "bag"/.test(why)), [true]);
    steady(host, 'after deleting the None');
});

test('deleting the reply that added the mount ridden, or the one ridden before: the riders stay whole', async t => {
    const host = await fresh(t);
    await host.send('Mare.', reply('Mare.', ['+ mount Grey Mare | kind: horse']));
    const mare = last(host);
    await ok(host, 'mounts.ride', { who: 'Mara', mount: 'Grey Mare' });
    await host.send('Burr.', reply('Burr.', ['+ mount Burr | kind: mule']));
    const burr = last(host);
    await host.send('On.', reply('On.', ['+ coin 1']));
    await ok(host, 'mounts.ride', { who: 'Mara', mount: 'Burr' });
    assert.deepEqual(wheres(host), [['Grey Mare', ''], ['Burr', 'ridden by Mara']]);
    await host.st.deleteMessage(mare);
    assert.deepEqual(wheres(host), [['Burr', 'ridden by Mara']], 'the mount she rode before is gone; she still rides Burr');
    steady(host, 'after deleting the first mount');
    await host.st.deleteMessage(burr - 1);
    assert.deepEqual(wheres(host), [], 'the mount she rides is gone: nothing left to ride');
    steady(host, 'after deleting the mount ridden');
});

test('the real path: gear.view through gearOf and selectParty fills the Mount and Bag slots and the pickers', async t => {
    const host = await fresh(t);
    await host.send('Kit.', reply('Kit.', ['+ item Leather Satchel', '+ mount Grey Mare | kind: horse | pace: 35']));
    await ok(host, 'inventory.carry', { stack: stackOf(host, 'Leather Satchel'), carry: 12 });
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Leather Satchel') });
    await ok(host, 'mounts.ride', { who: 'Mara', mount: 'Grey Mare' });
    const read = (name, args) => host.sdk.query(name, args);
    const actors = read('party.actors', {});
    const vm = selectParty({ actors, pc: read('party.pc', {}), levels: [], gear: gearOf(read, actors) });
    const mara = vm.members.find(member => member.id === MARA);
    const slot = key => mara.slots.find(entry => entry.key === key).item;
    assert.deepEqual([slot('mount').name, slot('mount').pace, slot('mount').stack], ['Grey Mare', 35, 'grey-mare']);
    assert.deepEqual([slot('bag').name, slot('bag').carry], ['Leather Satchel', 12]);
    assert.deepEqual(vm.carriers.mounts.map(row => [row.name, row.riders]), [['Grey Mare', ['Mara']]]);
    assert.deepEqual(vm.carriers.packs.map(row => [row.name, row.bag, row.by]), [['Leather Satchel', true, 'Mara']]);
});
