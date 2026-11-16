// Gear soak, load weights and animals (Combat rules v1 C8): soak per worn piece and slot, torn and broken give none, the carry table with horse, pony and cart,
// and replay equals live for gear edits. The fight engine does not read it yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, KIND_CARRY, condWord, kindCarry, soakFor, soakRecord } from '../../src/v2/domains/gear.js';
import { soakOf } from '../../src/v2/lean-rpg/gear.js';
import { createHarness } from './domains/helpers/fake-ctx.js';
import { def, stack } from './domains/fixtures.js';
import { crewState } from './gear-ui.helpers.js';
import { fresh, reply, equip } from './gear-inventory.helpers.js';

const piece = (slot, rarity = 'rare') => ({ id: 'x', kind: 'equipment', slot, rarity });

test('soak per slot: the rarity points in a protecting slot, none from a weapon, a bag or a non-equipment', () => {
    for (const slot of ['body', 'off-hand', 'head', 'cloak', 'feet', 'accessory', 'accessory-2']) assert.equal(soakFor(piece(slot), 100), 3, slot);
    assert.equal(soakFor(piece('weapon'), 100), 0);
    assert.equal(soakFor({ ...piece('body'), kind: 'goods' }, 100), 0);
    assert.deepEqual(['common', 'uncommon', 'rare', 'epic', 'legendary'].map(rarity => soakFor(piece('body', rarity))), [1, 2, 3, 4, 5]);
    assert.equal(soakFor(piece('body', null)), 0, 'no rarity, no points');
});

test('a torn or broken piece gives no soak; Worn still does; the cut is the Worn word', () => {
    for (const cond of [100, 70, 40]) assert.equal(soakFor(piece('body'), cond), 3, String(cond));
    for (const cond of [39, 33, 1, 0]) assert.equal(soakFor(piece('body'), cond), 0, String(cond));
    assert.equal(condWord(GEAR.soak.minCond), 'worn');
    assert.equal(condWord(GEAR.soak.minCond - 1), 'torn');
});

function dressed(cond) {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.defs['story/plate'] = def('story/plate', 'Plate', { kind: 'equipment', slot: 'body', rarity: 'epic', stack: false });
    inv.defs['story/cap'] = def('story/cap', 'Cap', { kind: 'equipment', slot: 'head', rarity: 'common', stack: false });
    inv.stacks.it_plate001 = stack('it_plate001', 'story/plate', 1, { equipped: 'body', ...(cond === undefined ? {} : { cond }) });
    inv.stacks.it_cap00001 = stack('it_cap00001', 'story/cap', 1, { equipped: 'head' });
    Object.assign(inv.stacks.it_sword001, { equipped: 'weapon' });
    return createHarness([module], { state });
}

test('gear.view, inventory.gear and the soak record carry soak per piece; the weapon gives none', () => {
    const h = dressed();
    const view = h.query('gear.view', {});
    assert.deepEqual([view.slots.body.soak, view.slots.head.soak, view.slots.weapon.soak, view.rows.it_plate001.soak, view.rows.it_rope0001.soak], [4, 1, 0, 4, 0]);
    assert.deepEqual(view.soak, { total: 5, pieces: [{ place: 'body', name: 'Plate', soak: 4 }, { place: 'head', name: 'Cap', soak: 1 }] });
    const gear = h.query('inventory.gear', { owner: 'party' });
    assert.deepEqual([gear.soak.total, gear.slots.body.soak, gear.slots.weapon.soak], [5, 4, 0]);
    assert.equal(h.query('gear.view', {}).bag.every(entry => Number.isSafeInteger(entry.soak)), true);
    assert.deepEqual(soakOf(['party'], owner => h.query('inventory.gear', { owner })), { total: 5, items: [{ name: 'Plate', soak: 4 }, { name: 'Cap', soak: 1 }] });
    assert.deepEqual(soakOf(['nobody', 'party'], owner => (owner === 'party' ? h.query('inventory.gear', { owner }) : null)).total, 5);
});

test('torn gives no soak in the answers: the plate at 30 is out, the cap stays', () => {
    const h = dressed(30);
    const view = h.query('gear.view', {});
    assert.deepEqual([view.slots.body.word, view.slots.body.soak, view.soak.total], ['torn', 0, 1]);
    assert.deepEqual(h.query('inventory.gear', { owner: 'party' }).soak.pieces.map(entry => entry.place), ['head']);
    assert.equal(soakRecord(h.state, 'party', (item) => item.cond ?? 100).total, 1);
    assert.equal(dressed(0).query('gear.view', {}).soak.total, 1, 'broken as well');
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
    assert.deepEqual([carry.weights.it_rope0001, carry.weights.it_sword001], [3, 1]);
    assert.equal(h.query('gear.view', {}).carry.capacity, 30 + 160, 'the shared bag: the reader\'s 30 and the animals; Ren\'s own 30 is his');
});

function gear0() { return crewState().module; }
function crewBare() { const { state } = crewState(); state.domains.scene.mounts = {}; return state; }

test('replay equals live for gear edits: equip, tear, swipe, reload and rebuild keep the soak the same', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Plate | slot: body | rarity: rare']));
    await equip(host, 'Iron Plate');
    await host.send('Fight.', reply('A blow.', ['~ hit body 3']));
    const soak = () => JSON.stringify([host.sdk.query('gear.view', {}).soak, host.sdk.query('inventory.gear', { owner: 'party' }).soak]);
    const torn = soak();
    assert.equal(JSON.parse(torn)[0].total, 0, 'three wear steps tear the piece, so it gives none');
    host.store.rebuild();
    assert.equal(soak(), torn, 'a rebuild equals live');
    await host.swipe(reply('Missed.', ['+ coin 1']));
    assert.equal(host.sdk.query('gear.view', {}).soak.total, 3, 'the swipe took the wear back');
    const swiped = soak();
    host.store.rebuild();
    assert.equal(soak(), swiped);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.deepEqual(host.store.problems(), []);
});
