// Load weights per item (Combat rules v1 C8b): a per-def weight from a pack or the reader's Bag Edit, a default by slot or kind that a story line or a hook cannot raise,
// coins weigh nothing, the approved mock's Bag rows as the table, and the Bag Edit's weight and soak for any unbound piece.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, weightFor, defaultWeight, packWeight } from '../../src/v2/domains/gear.js';
import { createHarness } from './domains/helpers/fake-ctx.js';
import { def, stack } from './domains/fixtures.js';
import { crewState } from './gear-ui.helpers.js';
import { createHost } from '../../testkit/index.js';
import { fresh, reply, equip, defNamed, wear } from './gear-inventory.helpers.js';
import { world, defOf } from './gear-start.helpers.js';
import { validatePack } from '../../src/v2/packs/validate.js';
import { pack } from './packs/helpers/fixtures.js';

// The mock's Bag rows (design/redo/bag.html I, load = Σ weight × qty at :485): [name, kind, slot, qty, weight]. A gear row whose weight is its slot's default carries no weight of its own.
const SLOT_OF = { weapon: 'weapon', offhand: 'off-hand', armor: 'body', accessory: 'accessory', cloak: 'cloak', feet: 'feet', head: 'head', bagslot: null };
const ROWS = [['Steel longsword', 'gear', 'weapon', 1, 3], ['Oak round shield', 'gear', 'offhand', 1, 4], ['Travel leathers', 'gear', 'armor', 1, 5], ['Silver ring', 'gear', 'accessory', 1, 0],
    ['Chain shirt', 'gear', 'armor', 1, 8], ['Red Cord oath-coin', 'gear', 'accessory', 1, 0], ['Greatsword', 'gear', 'weapon', 1, 6], ['Grey wool cloak', 'gear', 'cloak', 1, 2],
    ['Riding boots', 'gear', 'feet', 1, 2], ['Leather satchel', 'gear', 'bagslot', 1, 1], ['Iron cap', 'gear', 'head', 1, 2], ['Iron axe', 'gear', 'weapon', 1, 3],
    ['Tower shield', 'gear', 'offhand', 1, 6], ['Hob boots', 'gear', 'feet', 1, 2], ['Scout leathers', 'gear', 'armor', 1, 4], ['Green cloak', 'gear', 'cloak', 1, 2],
    ['Soft boots', 'gear', 'feet', 1, 1], ['Short bow', 'gear', 'weapon', 1, 2], ['Quiver bag', 'gear', 'bagslot', 1, 1], ['Brigandine', 'gear', 'armor', 1, 7],
    ['Hob boots (Torka)', 'gear', 'feet', 1, 2], ['Lucky ring', 'gear', 'accessory', 1, 0], ['Spare dagger', 'gear', 'weapon', 1, 1], ['Steel helm', 'gear', 'head', 1, 3],
    ['Healing draught', 'use', 'use', 3, 1], ['Antidote', 'use', 'use', 1, 1], ['Bread and cheese', 'use', 'use', 4, 2], ['Rope, 50 ft', 'goods', 'goods', 1, 4],
    ['Salted fish', 'goods', 'goods', 6, 6], ['Bolt of blue wool', 'goods', 'goods', 1, 5], ['Iron ore', 'material', 'material', 5, 5], ['Moonpetal', 'material', 'material', 2, 0],
    ['Sealed letter', 'quest', 'quest', 1, 0], ['Guild writ', 'quest', 'quest', 1, 0]];
const KIND_OF = { gear: 'equipment', use: 'consumable', goods: 'goods', material: 'material', quest: 'quest' };
const MOCK_LOAD = 149;

function mockState() {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.defs = {};
    inv.stacks = {};
    ROWS.forEach(([name, kind, glyph, qty, weight], n) => {
        const slot = kind === 'gear' ? SLOT_OF[glyph] : null;
        const probe = { kind: KIND_OF[kind], slot };
        const own = defaultWeight(probe) === weight ? {} : { weight };
        inv.defs[`pack.mock/r${n}`] = def(`pack.mock/r${n}`, name, { ...probe, stack: kind !== 'gear', ...own });
        inv.stacks[`it_mock${String(n).padStart(4, '0')}`] = stack(`it_mock${String(n).padStart(4, '0')}`, `pack.mock/r${n}`, qty, {});
    });
    return { module, state };
}

test('the mock\'s Bag rows are the table: every row weighs weight × count, the load is 149, and the defaults give the rows that carry no weight of their own', () => {
    const { module, state } = mockState();
    const carry = createHarness([module], { state }).query('gear.carry', {});
    ROWS.forEach(([name, , , qty, weight], n) => assert.equal(carry.weights[`it_mock${String(n).padStart(4, '0')}`], weight * qty, name));
    assert.equal(carry.load, MOCK_LOAD);
    assert.equal(carry.load, Object.values(carry.weights).reduce((sum, n) => sum + n, 0), 'load is the sum of the weights');
    const own = Object.values(state.domains.inventory.defs).filter(item => item.weight !== undefined).length;
    assert.ok(own > 0 && own < ROWS.length, 'some rows lean on the default by slot or kind and some carry a weight of their own');
    assert.deepEqual(ROWS.filter(([, kind, glyph, , weight]) => kind === 'gear' && defaultWeight({ kind: 'equipment', slot: SLOT_OF[glyph] }) === weight).map(row => row[0]).length, 15);
});

test('the default is by slot for equipment (weapon 3, body 5, off-hand 4, head 2, cloak 2, feet 2, accessory 0, no slot 1) and by kind for the rest (quest 0, else 1); coins 0', () => {
    assert.deepEqual(['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory', 'accessory-2', null].map(slot => weightFor({ kind: 'equipment', slot })), [3, 5, 4, 2, 2, 2, 0, 0, 1]);
    assert.deepEqual(['goods', 'material', 'consumable', 'quest', 'money'].map(kind => weightFor({ kind })), [1, 1, 1, 0, 0]);
    assert.equal(weightFor({ kind: 'money', weight: 5 }), 0, 'coins weigh nothing, whatever is written');
    assert.equal(weightFor({ kind: 'goods', weight: 0 }), 0, 'a weight of 0 is the item\'s own');
    assert.equal(weightFor({ kind: 'goods', weight: GEAR.weight.max }), GEAR.weight.max);
    assert.deepEqual([-1, 1.5, '3', GEAR.weight.max + 1, null].map(weight => weightFor({ kind: 'goods', weight })), [1, 1, 1, 1, 1], 'a bad value falls back to the default');
    assert.equal(packWeight('story/x', 4), null, 'only a pack def keeps a weight from outside');
    assert.deepEqual([packWeight('pack.a/b', 4), packWeight('pack.a/b', 100), packWeight('pack.a/b', -1)], [4, null, null]);
});

test('a pack item\'s weight is checked (0 to 99), kept on its def, and counted in load', async t => {
    const bad = [100, -1, 1.5, '3'].map(weight => validatePack(pack({ content: { items: [{ name: 'X', kind: 'goods', weight }] } })).ok);
    assert.deepEqual(bad, [false, false, false, false]);
    const host = await world(t, { packs: true, items: [{ name: 'Anvil', kind: 'goods', weight: 50 }, { name: 'Feather', kind: 'goods', weight: 0 }, { name: 'Pack Plate', kind: 'equipment', slot: 'body', weight: 7 }] });
    await host.send('Go.', reply('Loot.', ['+ item Anvil', '+ item Feather | qty: 3', '+ item Pack Plate']));
    assert.deepEqual(['Anvil', 'Feather', 'Pack Plate'].map(name => defOf(host, name).weight), [50, 0, 7]);
    const carry = host.sdk.query('gear.carry', {});
    assert.deepEqual(['Anvil', 'Feather', 'Pack Plate'].map(name => carry.weights[wear(host, name).stack]), [50, 0, 7]);
    assert.equal(carry.load, 57);
});

test('story lines and hooks cannot raise a weight or a soak: a line\'s `weight:` and `soak:` words give the slot default and the cap, a hook\'s written weight is dropped', async t => {
    t.mock.method(console, 'warn', () => {});
    const hook = { id: 'zz-hook', name: 'zz hook', version: '0.0.0', hooks: { 'item.define': item => (item.name === 'Hooked Plate' ? { weight: 0, soak: 9 } : null) } };
    const host = await createHost({ modules: [hook],
        settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Loot.', reply('Gear.', ['+ item Iron Plate | slot: body | weight: 0 | soak: 9', '+ item Light Sack | weight: 0', '+ item Hooked Plate | slot: body']));
    assert.deepEqual(['Iron Plate', 'Light Sack', 'Hooked Plate'].map(name => defNamed(host, name).weight), [undefined, undefined, undefined]);
    assert.deepEqual(['Iron Plate', 'Hooked Plate'].map(name => defNamed(host, name).soak), [2, 2], 'soak only to the cap');
    const carry = host.sdk.query('gear.carry', {});
    assert.deepEqual(['Iron Plate', 'Light Sack', 'Hooked Plate'].map(name => carry.weights[wear(host, name).stack]), [5, 1, 5]);
});

test('the Bag Edit sets a weight on any unbound piece, any time: a story\'s, a pack\'s and a hand-made one; the load follows and every piece of the item changes', async t => {
    const host = await world(t, { packs: true, items: [{ name: 'Pack Plate', kind: 'equipment', slot: 'body', weight: 7 }] });
    await host.send('Go.', reply('Loot.', ['+ item Story Rope | qty: 4', '+ item Pack Plate', '+ item Iron Axe | slot: weapon']));
    const added = await host.sdk.command('inventory.add', { name: 'Home Rock', qty: 2, kind: 'goods' });
    const load = () => host.sdk.query('gear.carry', {}).load;
    assert.equal(load(), 4 + 7 + 3 + 2);
    for (const [name, weight, expected] of [['Story Rope', 3, 3 * 4 + 7 + 3 + 2], ['Pack Plate', 2, 12 + 2 + 3 + 2], ['Iron Axe', 0, 12 + 2 + 0 + 2], ['Home Rock', 6, 12 + 2 + 0 + 12]]) {
        const out = await host.sdk.command('inventory.edit', { stack: wear(host, name).stack, weight });
        assert.equal(out.ok, true, `${name}: ${out.message}`);
        assert.equal(defOf(host, name).weight, weight, name);
        assert.equal(load(), expected, name);
    }
    assert.equal(added.ok, true);
    assert.equal(host.sdk.query('gear.view', {}).rows[wear(host, 'Pack Plate').stack].weight, 2, 'gear.view says what a unit weighs for the Edit form');
    assert.equal(host.sdk.query('gear.view', {}).carry.load, load());
});

test('the Bag Edit sets soak on a story-given armour piece after the first message, held to the slot cap and named when over; a bad weight or soak is refused and nothing changes', async t => {
    const host = await world(t);
    await host.send('Go.', reply('Loot.', ['+ item Iron Plate | slot: body', '+ item Wool Cloak | slot: cloak', '+ item Plain Rope', '+ coin 5']));
    const plate = wear(host, 'Iron Plate').stack;
    assert.equal(defOf(host, 'Iron Plate').soak, undefined, 'the story gave none');
    assert.equal((await host.sdk.command('inventory.edit', { stack: plate, soak: 2 })).ok, true);
    assert.equal(defOf(host, 'Iron Plate').soak, 2);
    const row = host.sdk.query('gear.view', {}).rows[plate];
    assert.deepEqual([row.soakOwn, row.soakMax, row.weight], [2, 2, 5]);
    const refuse = async (stackId, payload, pattern) => {
        const out = await host.sdk.command('inventory.edit', { stack: stackId, ...payload });
        assert.equal(out.ok, false, JSON.stringify(payload));
        assert.match(out.message, pattern);
    };
    await refuse(plate, { soak: 3 }, /at most 2/);
    await refuse(wear(host, 'Wool Cloak').stack, { soak: 1 }, /at most 0/);
    await refuse(wear(host, 'Plain Rope').stack, { soak: 1 }, /at most 0/);
    await refuse(plate, { soak: -1 }, /whole number/);
    await refuse(plate, { weight: 100 }, /0 to 99/);
    await refuse(plate, { weight: -1 }, /0 to 99/);
    await refuse(plate, { weight: 2.5 }, /0 to 99/);
    assert.deepEqual([defOf(host, 'Iron Plate').soak, defOf(host, 'Iron Plate').weight], [2, undefined]);
    assert.equal((await host.sdk.command('inventory.edit', { stack: plate, soak: 0 })).ok, true);
    assert.equal(defOf(host, 'Iron Plate').soak, undefined, 'soak 0 is no soak');
    await equip(host, 'Iron Plate');
    assert.equal((await host.sdk.command('inventory.edit', { stack: plate, soak: 1 })).ok, true, 'a worn piece too');
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).soak.total, 1);
});

test('the Bag Edit refuses weight and soak with gear off; coins cannot be given a weight; and it changes nothing else of the item', async t => {
    const off = await world(t, { gear: false });
    await off.send('Go.', reply('Loot.', ['+ item Story Rope']));
    const refused = await off.sdk.command('inventory.edit', { stack: wear(off, 'Story Rope').stack, weight: 3 });
    assert.equal(refused.ok, false);
    assert.equal(defOf(off, 'Story Rope').weight, undefined);
    const host = await world(t);
    await host.send('Go.', reply('Loot.', ['+ item Story Rope | qty: 2']));
    const before = { ...defOf(host, 'Story Rope') };
    assert.equal((await host.sdk.command('inventory.edit', { stack: wear(host, 'Story Rope').stack, weight: 0 })).ok, true);
    assert.deepEqual(defOf(host, 'Story Rope'), { ...before, weight: 0 }, 'only the weight moved');
    const money = Object.values(host.head().domains.inventory.stacks).find(item => host.head().domains.inventory.defs[item.def].kind === 'money');
    assert.equal(money, undefined, 'coins are the money domain\'s, not a stack of the bag');
});
