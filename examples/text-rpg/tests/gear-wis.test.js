// The gear's sixth stat (WIS) is Text RPG's sixth (wis): counted by position, and shown under Text RPG's own stat names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUY, astraOf, newHost, reply, withAstra } from './helpers/host.js';
import { astra } from './helpers/fake-ctx.js';
import { gearOf, totalStats } from '../src/module-parts/gear.js';
import { poolWith } from '../src/module-parts/gear-sizes.js';
import { rowOf } from '../src/module-parts/sheet-row.js';
import { statLabelsOf } from '../src/module-parts/stat-labels.js';

const worn = (name, rarity, bonus) => kind => (kind === 'gear.view' ? { slots: { head: { name, rarity, bonus, broken: false } } } : null);
const member = () => astra({ stats: { str: 12, vit: 12, agi: 12, dex: 12, int: 13, wis: 12, cha: 12 } });

test('a WIS piece is +WIS (and an older "+3 LUK" is too): the cap, the effective stat and the pools follow', () => {
    assert.deepEqual(gearOf(worn('Clover charm', 'rare', '+3 LUK'), member()).cap, { WIS: 3 });
    const gear = gearOf(worn('Clover charm', 'rare', '+3 WIS'), member());
    assert.deepEqual(gear.cap, { WIS: 3 });
    assert.equal(totalStats(member(), gear.cap).wis, 15);
    assert.equal(totalStats(member(), gear.cap).int, 13);
    assert.equal(poolWith(member(), 'mp', gear.cap).max, poolWith(member(), 'mp', { INT: 3 }).max, 'int + wis pool: +3 wis counts as +3 int would');
    assert.deepEqual(rowOf(member(), null, gear.cap).bonus, { WIS: 3 }, 'the sheet row shows it');
});

test('the other stats map by position too, and a name the gear lacks is ignored', () => {
    const gear = gearOf(worn('Ring', 'epic', '+1 STR +2 CHA'), member());
    assert.deepEqual(gear.cap, { STR: 1, CHA: 2 });
    assert.deepEqual(gearOf(worn('Odd', 'common', '+1 MAG'), member()).cap, {}, 'MAG is not a gear name');
});

test('statLabelsOf: the setting by position; a blank or missing name is the stat key', () => {
    const settings = statNames => ({ settings: () => ({ statNames }) });
    assert.deepEqual(statLabelsOf(settings('STR, VIT, AGI, DEX, INT, WIS, CHA')), ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
    assert.deepEqual(statLabelsOf(settings('Might, , Speed')), ['Might', 'VIT', 'Speed', 'DEX', 'INT', 'WIS', 'CHA']);
    assert.deepEqual(statLabelsOf({}), ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
});

test('gear.statLabels: Text RPG answers while on, the gear\'s own names otherwise', async t => {
    t.mock.method(console, 'warn', () => {});
    const on = await newHost({ 'text-rpg.on': true });
    const off = await newHost({ 'text-rpg.on': false });
    t.after(() => { on.close(); off.close(); });
    assert.deepEqual(on.sdk.query('gear.statLabels'), ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
    assert.deepEqual(off.sdk.query('gear.statLabels'), ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
});

test('a worn WIS piece raises the Text RPG sheet\'s wis, and rebuild equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({ 'story-block.gear': true }, undefined, { stats: { ...BUY, wis: 8, str: 5 } });
    t.after(() => host.close());
    await host.send('Loot.', reply('A charm.', ['+ item Clover charm | slot: head']));
    const stack = host.sdk.query('inventory.items').find(item => item.name === 'Clover charm').stack;
    const moved = await host.sdk.command('inventory.edit', { stack, stats: { WIS: 1 } });
    assert.equal(moved.ok, true, moved.message);
    assert.equal((await host.sdk.command('inventory.equip', { stack })).ok, true);
    const row = host.sdk.query('rpg.sheet').find(item => item.name === 'Astra');
    assert.equal(row.bonus.WIS, 1, 'a WIS point of gear is in the sheet WIS');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    assert.ok(astraOf(host));
});
