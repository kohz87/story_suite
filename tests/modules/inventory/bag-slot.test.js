// The Party paper-doll's Bag slot (`inventory.bag`, commands/bag.js): a member carries one bag-like item as their bag (filed under
// BAG_PLACE), a companion's is handed to them and the old one goes back to the party's bag, None frees it, the refusals say why,
// gear.view's Bag slot and pickers follow, and replay equals live after a swipe, an edited Re-read, a middle delete and a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { validateInventory } from '../../../modules/inventory/index.js';

const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_wessel01', name: 'Wessel' }] } };
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const MARA = 'ac_mara0001';

async function fresh(t, extra = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [ACTORS], settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } }, ...extra });
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['+ item Leather Satchel', '+ item Bag', '+ item Iron Sword', '+ item Rope']));
    return host;
}
const stackOf = (host, name, owner = null) => host.sdk.query('inventory.items').find(item => item.name === name && (owner === null || item.owner === owner))?.stack;
const run = async (host, name, payload) => {
    const out = await host.sdk.command(name, payload);
    assert.equal(out.ok, true, out.message);
    return out;
};
const bagState = host => host.sdk.query('inventory.items').filter(item => item.equipped === 'bag').map(item => [item.name, item.owner]).sort();
// (the shared bag's own capacity: the party's total less the room of the members counted by themselves)
const shared = host => { const all = host.sdk.query('gear.carry', {}); return { capacity: all.capacity - all.people.reduce((sum, person) => sum + person.capacity, 0) }; };

test('a companion carries a bag: it is handed to them, the shared capacity follows, a swap and None put the old one back', async t => {
    const host = await fresh(t);
    await run(host, 'inventory.carry', { stack: stackOf(host, 'Leather Satchel'), carry: 12 });
    const before = shared(host);
    const out = await run(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Leather Satchel') });
    assert.match(out.receipt.summary, /carries Leather Satchel as a bag \(\+12 load\)/);
    assert.deepEqual(bagState(host), [['Leather Satchel', MARA]]);
    const view = host.sdk.query('gear.view', { owner: MARA });
    assert.deepEqual(view.bagSlot, { stack: stackOf(host, 'Leather Satchel'), name: 'Leather Satchel', carry: 12 });
    assert.ok(shared(host).capacity < before.capacity, 'the party\'s bag lost the satchel\'s room');
    // A swap: the Bag (no carry, a bag by its name) for Mara; the satchel goes back to the party.
    await run(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Bag') });
    assert.deepEqual(bagState(host), [['Bag', MARA]]);
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Leather Satchel').owner, 'party');
    assert.deepEqual(shared(host).capacity, before.capacity);
    // None: the Bag back in the party's bag.
    await run(host, 'inventory.bag', { owner: MARA, stack: null });
    assert.deepEqual(bagState(host), []);
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Bag').owner, 'party');
    assert.deepEqual(validateInventory(host.head().domains.inventory), []);
});

test('the main character\'s bag stays in the party\'s bag and is only marked; None unmarks it', async t => {
    const host = await fresh(t);
    await run(host, 'inventory.bag', { owner: 'party', stack: stackOf(host, 'Leather Satchel') });
    assert.deepEqual(bagState(host), [['Leather Satchel', 'party']]);
    assert.equal(host.sdk.query('gear.view', { owner: 'party' }).bagSlot.name, 'Leather Satchel');
    await run(host, 'inventory.bag', { owner: 'party', stack: stackOf(host, 'Bag') });
    assert.deepEqual(bagState(host), [['Bag', 'party']], 'one bag each');
    await run(host, 'inventory.bag', { owner: 'party', stack: null });
    assert.deepEqual(bagState(host), []);
    assert.equal(host.sdk.query('gear.view', { owner: 'party' }).bagSlot, null);
});

test('the refusals: not a bag, a piece with its own slot, already the bag, no bag to free, someone not in the party', async t => {
    const host = await fresh(t);
    for (const [payload, pattern] of [
        [{ owner: MARA, stack: stackOf(host, 'Rope') }, /Rope is not a bag: it adds no load/],
        [{ owner: MARA, stack: stackOf(host, 'Iron Sword') }, /Iron Sword is worn in a slot of its own \(weapon\)/],
        [{ owner: MARA, stack: null }, /carries no bag/],
        [{ owner: 'ac_nobody01', stack: stackOf(host, 'Bag') }, /not in the party/],
    ]) {
        const out = await host.sdk.command('inventory.bag', payload);
        assert.equal(out.ok, false, JSON.stringify(payload));
        assert.match(out.message, pattern);
    }
    await run(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Bag') });
    const again = await host.sdk.command('inventory.bag', { owner: MARA, stack: stackOf(host, 'Bag', MARA) });
    assert.equal(again.ok, false);
    assert.match(again.message, /already .+'s bag/);
});

test('the Bag picker list: every bag-like item with whose it is and whether it is someone\'s bag', async t => {
    const host = await fresh(t);
    await run(host, 'inventory.carry', { stack: stackOf(host, 'Leather Satchel'), carry: 12 });
    await run(host, 'inventory.bag', { owner: 'ac_wessel01', stack: stackOf(host, 'Leather Satchel') });
    const packs = host.sdk.query('gear.view', { owner: MARA }).carriers.packs.map(({ name, carry, by, bag }) => [name, carry, by, bag]);
    assert.deepEqual(packs.map(([name, carry, , bag]) => [name, carry, bag]).sort(), [['Bag', 0, false], ['Leather Satchel', 12, true]]);
    assert.equal(packs.find(row => row[0] === 'Leather Satchel')[2], 'Wessel', 'whose bag it is');
    assert.equal(packs.some(row => row[0] === 'Rope' || row[0] === 'Iron Sword'), false, 'only bags are listed');
});

test('replay equals live: a swipe, an edited Re-read, a middle delete and a reload', async t => {
    const host = await fresh(t);
    await host.send('On.', reply('The ford.', ['+ item Old Sack']));
    const middle = host.ctx.chat.length - 1;
    await host.send('Go.', reply('The hill.', ['+ coin 2']));
    await run(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Leather Satchel') });
    await run(host, 'inventory.bag', { owner: 'party', stack: stackOf(host, 'Bag') });
    const stable = () => JSON.stringify([bagState(host), host.sdk.query('gear.view', { owner: MARA }).bagSlot?.name, shared(host)]);
    const live = stable();
    host.store.rebuild();
    assert.equal(stable(), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [ACTORS], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.deepEqual(loaded.head().domains.inventory, host.head().domains.inventory, 'a reload equals live');
    // An edited Re-read of the head reply keeps the bags (the reader's commands ride on it).
    const head = host.ctx.chat.length - 1;
    host.ctx.chat[head].mes = reply('The hill, told again.', ['+ coin 3']);
    assert.equal((await host.turn.reread(head)).ok, true);
    assert.deepEqual(bagState(host), [['Bag', 'party'], ['Leather Satchel', MARA]]);
    // A middle delete (the Old Sack's reply): the bags stay, the inventory is valid, a rebuild agrees.
    await host.st.deleteMessage(middle);
    assert.deepEqual(bagState(host), [['Bag', 'party'], ['Leather Satchel', MARA]]);
    assert.deepEqual(validateInventory(host.head().domains.inventory), []);
    const after = stable();
    host.store.rebuild();
    assert.equal(stable(), after, 'a rebuild equals live after the delete');
    // A swipe of the head reply: the reader's bag choices were kept on it, so the new swipe has none of them.
    await host.swipe(reply('Elsewhere.', ['+ coin 1']));
    assert.deepEqual(bagState(host), []);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(bagState(host), [['Bag', 'party'], ['Leather Satchel', MARA]], 'back on the first swipe, its bags are back');
});
