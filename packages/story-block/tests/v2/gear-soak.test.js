// Gear soak per item (Combat rules v1 C8): each piece's own soak held to its slot's cap, torn and broken give none, the mock's four heroes, story lines and Edit cannot mint it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, KIND_CARRY, kindCarry, condWord, soakFor, soakCap, soakTotal, soakRecord } from '../../src/v2/domains/gear.js';
import { gearSoakRecord } from '../../src/v2/lean-rpg/gear.js';
import { createHarness } from './domains/helpers/fake-ctx.js';
import { def, stack } from './domains/fixtures.js';
import { crewState } from './gear-ui.helpers.js';
import { fresh, reply, equip, defNamed } from './gear-inventory.helpers.js';
import { world, defOf } from './gear-start.helpers.js';
import { validatePack } from '../../src/v2/packs/validate.js';
import { pack } from './packs/helpers/fixtures.js';

const piece = (slot, soak = 2, rarity = 'rare') => ({ id: 'x', kind: 'equipment', slot, rarity, soak });

test('soak is the item\'s own value held to the slot cap: body 2, off-hand 2, head 1, cloak, feet, accessory and weapon 0; rarity never sets it', () => {
    assert.deepEqual(['body', 'off-hand', 'head', 'cloak', 'feet', 'accessory', 'accessory-2', 'weapon'].map(soakCap), [2, 2, 1, 0, 0, 0, 0, 0]);
    assert.deepEqual(['body', 'off-hand', 'head', 'cloak', 'feet', 'accessory', 'accessory-2', 'weapon'].map(slot => soakFor(piece(slot, 9), 100)), [2, 2, 1, 0, 0, 0, 0, 0]);
    assert.equal(soakFor({ ...piece('body'), kind: 'goods' }, 100), 0);
    assert.deepEqual(['common', 'epic', 'legendary', null].map(rarity => soakFor(piece('body', 1, rarity))), [1, 1, 1, 1], 'the same soak at any rarity');
    assert.deepEqual([undefined, 0, -1, 1.5, '2'].map(soak => soakFor({ ...piece('body'), soak })), [0, 0, 0, 0, 0], 'no soak given: none');
    assert.equal(soakFor(piece('body', 2), 100, 'head'), 1, 'the place the piece is worn at sets the cap');
});

test('a torn or broken piece gives no soak; Worn still does; the cut is the Worn word', () => {
    for (const cond of [100, 70, 40]) assert.equal(soakFor(piece('body'), cond), 2, String(cond));
    for (const cond of [39, 33, 1, 0]) assert.equal(soakFor(piece('body'), cond), 0, String(cond));
    assert.equal(condWord(GEAR.soak.minCond), 'worn');
    assert.equal(condWord(GEAR.soak.minCond - 1), 'torn');
});

// The approved mock's kits (design/redo/party.html IT + eq, bag.html rows): [slot, soak] by piece, the hero's VIT and what the mock shows.
const KITS = {
    Astra: { vit: 10, mock: 11, worn: [['body', 0], ['cloak', 0], ['feet', 0], ['accessory-1', 0], ['off-hand', 1]] },
    Torka: { vit: 11, mock: 13, worn: [['body', 2], ['feet', 0], ['accessory-1', 0]] },
    Rika: { vit: 8, mock: 8, worn: [['body', 0], ['cloak', 0], ['feet', 0]] },
    Brann: { vit: 12, mock: 17, worn: [['head', 1], ['body', 2], ['feet', 0], ['off-hand', 2], ['accessory-1', 0]] },
};

function kitState(kit, cond) {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    kit.worn.forEach(([place, soak], n) => {
        const slot = place.replace(/-\d$/, '');
        inv.defs[`story/k${n}`] = def(`story/k${n}`, `Kit ${n}`, { kind: 'equipment', slot, rarity: n % 2 ? 'epic' : '', stack: false, ...(soak ? { soak } : {}) });
        inv.stacks[`it_kit0000${n}`] = stack(`it_kit0000${n}`, `story/k${n}`, 1, { equipped: place, ...(cond && n === 4 ? { cond } : {}) });
    });
    return createHarness([module], { state });
}

test('the mock\'s four heroes: VIT + their kit\'s soak is Astra 11, Torka 13, Rika 8, Brann 17 (22 with Shield wall)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
        const total = kitState(kit).query('inventory.gear', { owner: 'party' }).soak.total;
        assert.equal(soakTotal(kit.vit, total), kit.mock, name);
    }
    assert.equal(soakTotal(12, 5, 5), 22);
    assert.equal(soakTotal(60, 0), 50, 'the 50 cap');
    assert.equal(soakTotal(0, 0), 1);
});

test('the mock\'s torn Oak round shield gives none here (the plan\'s rule): Astra is 10 with it torn', () => {
    const h = kitState(KITS.Astra, 30);
    assert.equal(soakTotal(10, h.query('inventory.gear', { owner: 'party' }).soak.total), 10);
});

function dressed(cond) {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.defs['story/plate'] = def('story/plate', 'Plate', { kind: 'equipment', slot: 'body', rarity: 'epic', stack: false, soak: 2 });
    inv.defs['story/cap'] = def('story/cap', 'Cap', { kind: 'equipment', slot: 'head', rarity: 'common', stack: false, soak: 1 });
    inv.stacks.it_plate001 = stack('it_plate001', 'story/plate', 1, { equipped: 'body', ...(cond === undefined ? {} : { cond }) });
    inv.stacks.it_cap00001 = stack('it_cap00001', 'story/cap', 1, { equipped: 'head' });
    Object.assign(inv.stacks.it_sword001, { equipped: 'weapon' });
    return createHarness([module], { state });
}

test('gear.view, inventory.gear and the soak record carry soak per piece; the weapon gives none', () => {
    const h = dressed();
    const view = h.query('gear.view', {});
    assert.deepEqual([view.slots.body.soak, view.slots.head.soak, view.slots.weapon.soak, view.rows.it_plate001.soak, view.rows.it_rope0001.soak], [2, 1, 0, 2, 0]);
    assert.deepEqual(view.soak, { total: 3, pieces: [{ place: 'body', name: 'Plate', soak: 2 }, { place: 'head', name: 'Cap', soak: 1 }] });
    const gear = h.query('inventory.gear', { owner: 'party' });
    assert.deepEqual([gear.soak.total, gear.slots.body.soak, gear.slots.weapon.soak], [3, 2, 0]);
    assert.equal(h.query('gear.view', {}).bag.every(entry => Number.isSafeInteger(entry.soak)), true);
    assert.deepEqual(gearSoakRecord(['party'], owner => h.query('inventory.gear', { owner })), { total: 3, items: [{ name: 'Plate', soak: 2 }, { name: 'Cap', soak: 1 }] });
    assert.deepEqual(gearSoakRecord(['nobody', 'party'], owner => (owner === 'party' ? h.query('inventory.gear', { owner }) : null)).total, 3);
});

test('torn gives no soak in the answers: the plate at 30 is out, the cap stays', () => {
    const h = dressed(30);
    const view = h.query('gear.view', {});
    assert.deepEqual([view.slots.body.word, view.slots.body.soak, view.soak.total], ['torn', 0, 1]);
    assert.deepEqual(h.query('inventory.gear', { owner: 'party' }).soak.pieces.map(entry => entry.place), ['head']);
    assert.equal(soakRecord(h.state, 'party', (item) => item.cond ?? 100).total, 1);
    assert.equal(dressed(0).query('gear.view', {}).soak.total, 1, 'broken as well');
});

test('story lines cannot mint soak: `soak: N` is held to the slot cap, no word gives none, and a rarity word gives none', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Plate | slot: body | soak: 9', '+ item Oak Cap | slot: head | soak: 2', '+ item Wool Cloak | slot: cloak | soak: 2', '+ item Rune Ring | slot: accessory | rarity: epic | soak: 3', '+ item Plain Vest | slot: body | rarity: epic']));
    assert.deepEqual(['Iron Plate', 'Oak Cap', 'Wool Cloak', 'Rune Ring', 'Plain Vest'].map(name => defNamed(host, name).soak), [2, 1, undefined, undefined, undefined]);
    for (const name of ['Iron Plate', 'Oak Cap', 'Wool Cloak', 'Rune Ring']) await equip(host, name);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).soak.total, 3);
});

test('the Bag Edit sets soak on a hand-made piece within the cap, with the cap named; a hand-made piece is not special any more and any time works', async t => {
    const host = await world(t);
    const added = await host.sdk.command('inventory.add', { name: 'Home Shield', qty: 1, kind: 'equipment', slot: 'off-hand' });
    assert.equal(added.ok, true, added.message);
    const stackId = added.receipt.data.stacks[0];
    const over = await host.sdk.command('inventory.edit', { stack: stackId, soak: 5 });
    assert.equal(over.ok, false, 'over the cap is refused, not lowered quietly');
    assert.match(over.message, /at most 2/);
    assert.equal(defOf(host, 'Home Shield').soak, undefined);
    assert.equal((await host.sdk.command('inventory.edit', { stack: stackId, soak: 2 })).ok, true);
    assert.equal(defOf(host, 'Home Shield').soak, 2);
    assert.equal((await host.sdk.command('inventory.edit', { stack: stackId, soak: -1 })).ok, false);
    const rope = await host.sdk.command('inventory.add', { name: 'Home Rope', qty: 1, kind: 'goods' });
    assert.equal((await host.sdk.command('inventory.edit', { stack: rope.receipt.data.stacks[0], soak: 1 })).ok, false, 'not equipment');
    await host.send('Go.', 'The road.');
    assert.equal((await host.sdk.command('inventory.edit', { stack: stackId, soak: 1 })).ok, true, 'soak is not the starting kit\'s: it works after the first message');
    assert.equal(defOf(host, 'Home Shield').soak, 1);
});

test('carry: weights in load, the table, and animals add only when they travel with the party', () => {
    assert.deepEqual([KIND_CARRY.horse, KIND_CARRY.pony, KIND_CARRY.cart, kindCarry('Draft Horse'), kindCarry('pony'), kindCarry('hand-cart')], [40, 30, 60, 40, 30, 60]);
    const { module, state } = crewState();
    state.domains.scene.mounts = {
        'm:a': { name: 'Dapple', kind: 'horse', count: 1, where: 'ridden by Astra' },
        'm:b': { name: 'Nib', kind: 'pony', count: 2, where: '' },
        'm:c': { name: 'Wain', kind: 'cart', count: 1, where: 'hitched' },
        'm:d': { name: 'Skiff', kind: 'boat', count: 1, where: 'moored at Eel Wharf' },
    };
    const h = createHarness([module], { state });
    const base = createHarness([gear0()], { state: crewBare() }).query('gear.carry', {});
    const carry = h.query('gear.carry', {});
    assert.equal(carry.unit, 'load');
    assert.deepEqual(carry.animals.map(row => [row.name, row.carry, row.withParty]), [['Dapple', 40, true], ['Nib', 60, true], ['Wain', 60, true], ['Skiff', 100, false]]);
    assert.equal(carry.capacity - base.capacity, 40 + 60 + 60, 'the boat left at the wharf adds nothing');
    assert.deepEqual([carry.weights.it_rope0001, carry.weights.it_sword001], [3, 3], 'the rope 3 × 1; the sword the weapon default, 3');
    assert.equal(h.query('gear.view', {}).carry.capacity, 30 + 160, 'the shared bag: the reader\'s 30 and the animals; Ren\'s own 30 is his');
});

function gear0() { return crewState().module; }
function crewBare() { const { state } = crewState(); state.domains.scene.mounts = {}; return state; }


test('a pack item\'s own soak (0…2) is kept and still held to its slot\'s cap; a value over 2 is refused by the pack check', async t => {
    const host = await world(t, { packs: true, items: [
        { name: 'Pack Plate', kind: 'equipment', slot: 'body', rarity: 'common', soak: 2 }, { name: 'Pack Helm', kind: 'equipment', slot: 'head', rarity: 'epic', soak: 2 },
        { name: 'Pack Boots', kind: 'equipment', slot: 'feet', rarity: 'rare', soak: 2 }] });
    await host.send('Go.', reply('Gear.', ['+ item Pack Plate', '+ item Pack Helm', '+ item Pack Boots']));
    assert.deepEqual(['Pack Plate', 'Pack Helm', 'Pack Boots'].map(name => defOf(host, name).soak), [2, 2, 2]);
    for (const name of ['Pack Plate', 'Pack Helm', 'Pack Boots']) await equip(host, name);
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: 'party' }).soak.pieces.map(entry => [entry.name, entry.soak]), [['Pack Plate', 2], ['Pack Helm', 1]]);
    const bad = validatePack(pack({ content: { items: [{ name: 'X', kind: 'equipment', slot: 'body', soak: 3 }] } }));
    assert.equal(bad.ok, false);
});

test('coins weigh nothing: load, weights and the add check agree when the party holds money', () => {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.defs['story/coin'] = def('story/coin', 'Silver', { kind: 'money', stack: true });
    inv.stacks.it_coin0001 = stack('it_coin0001', 'story/coin', 500, {});
    const h = createHarness([module], { state });
    const carry = h.query('gear.carry', {});
    assert.equal(carry.weights.it_coin0001, 0);
    assert.equal(carry.load, Object.values(carry.weights).reduce((sum, n) => sum + n, 0), 'load = the sum of the weights');
    assert.equal(carry.load, h.query('gear.carry', {}).bag + Object.entries(carry.weights).filter(([id]) => inv.stacks[id].owner !== 'party').reduce((sum, [, n]) => sum + n, 0));
    assert.equal(h.query('gear.view', {}).carry.load, h.query('inventory.gear', { owner: 'party' }).carry.load);
});
