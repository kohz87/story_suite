// Gear counts in the pool sizes: the size is read from the stats with gear (capped by rarity), `now` stays a counter read clamped; replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUY, astraOf, reply, withAstra } from './helpers/host.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { poolWith } from '../src/module-parts/gear-sizes.js';
import { poolOf } from '../src/module-parts/effective.js';
import { capabilityLine } from '../src/module-parts/capability.js';
import { rest } from '../src/module-parts/commands/rest.js';
import { spend } from '../src/module-parts/commands/spend.js';
import { rowOf } from '../src/module-parts/sheet-row.js';

// Astra's Mana is int + wis: 12 + 12 = 24 → size 8 + 6 = 14; +2 int (a rare piece) → 26 → 14; +4 → 28 → 15.
const mind = (name, rarity, bonus) => ({ head: { name, rarity, bonus, broken: false } });
const gearQuery = slots => (name) => (name === 'gear.view' ? { slots } : null);
const odd = () => astra({ stats: { str: 12, vit: 12, agi: 12, dex: 12, int: 13, wis: 12, cha: 12 } }); // int + wis = 25: one more point of int crosses nothing, two cross

test('poolWith: the size reads the stats with gear capped by rarity; with no cap it is poolOf', () => {
    const member = odd();
    assert.equal(poolWith(member, 'mp', {}).max, poolOf(member, 'mp').max);
    assert.equal(poolOf(member, 'mp').max, 14);
    assert.equal(poolWith(member, 'mp', { INT: 3 }).max, 15, 'int 13+3 + wis 12 = 28');
    assert.equal(poolWith(member, 'sp', { INT: 3 }).max, poolOf(member, 'sp').max, 'stamina is not an int pool');
});

test('the capability line, the row and rest read the size with gear; removing the gear moves the read size back and `now` reads clamped', () => {
    const member = odd();
    const cap = { INT: 3 };
    member.pools.mp.now = 15;
    assert.equal(poolWith(member, 'mp', cap).now, 15);
    assert.equal(poolWith(member, 'mp', {}).now, 14, 'without the gear the counter reads clamped');
    assert.equal(member.pools.mp.now, 15, 'the counter itself is kept');
    const bar = row => row.bars.find(item => item.kind === 'mp');
    assert.equal(bar(rowOf(member, null, cap)).max, 15);
    assert.equal(bar(rowOf(member, null, {})).max, 14);
    assert.match(capabilityLine(member, { cap, names: [] }), /Mana: /);
    const slice = sliceOf([member], null);
    const ctx = fakeCtx(slice, { query: gearQuery(mind('Circlet', 'rare', '+3 INT')) });
    assert.equal(run(rest, ctx, { kind: 'short' }).ok, true);
    assert.equal(slice.members[member.id].pools.mp.now, 15, 'a rest fills to the size with the gear');
});

test('the sheet row carries the capped bonus the rolls use, not the uncapped one', () => {
    const member = odd();
    assert.deepEqual(rowOf(member, null, { INT: 1, STR: 2 }).bonus, { STR: 2, INT: 1 });
    assert.deepEqual(rowOf(member, null, {}).bonus, {});
    assert.deepEqual(rowOf(astra({ companion: { level: 1, strengths: [] } }), null, { INT: 1 }).bonus, {});
});

test('spend: points bought move the counter by the change in the size with gear', () => {
    const member = odd();
    member.xp = 400; // levels with points to spend
    member.pools.mp.now = 14;
    const slice = sliceOf([member], null);
    const ctx = fakeCtx(slice, { query: gearQuery(mind('Circlet', 'common', '+3 INT')) });
    const done = run(spend, ctx, { member: member.id, stats: { INT: 1, WIS: 1 } });
    assert.equal(done.ok, true, done.message);
    assert.equal(slice.members[member.id].pools.mp.now, 15, 'the size with +1 int of gear went from 14 to 15');
});

test('Text RPG with a worn piece: equip raises the Stamina size, removing lowers it, rebuild equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({ 'story-block.gear': true }, undefined, { stats: { ...BUY, str: 10, agi: 6, dex: 5 } });
    t.after(() => host.close());
    const row = () => host.sdk.query('rpg.sheet').find(item => item.name === 'Astra');
    const sp = () => row().bars.find(bar => bar.kind === 'sp').max;
    assert.equal(sp(), 10, 'agi 6 + dex 5');
    await host.send('Loot.', reply('Boots.', ['+ item Wolfhide Boots | slot: feet | +2 agi']));
    const stack = host.sdk.query('inventory.items').find(item => item.name === 'Wolfhide Boots').stack;
    assert.equal((await host.sdk.command('inventory.equip', { stack })).ok, true);
    assert.equal(sp(), 11, 'a common piece counts +1 of its +2');
    assert.equal(row().bonus.AGI, 1, 'the row shows the capped bonus');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    assert.equal(sp(), 11);
    assert.equal(astraOf(host).pools.sp.now, 10, 'the counter was never written by the gear');
    const out = await host.sdk.command('inventory.unequip', { stack });
    assert.equal(out.ok, true, out.message);
    assert.equal(sp(), 10);
    assert.equal(row().bars.find(bar => bar.kind === 'sp').value, 10);
});
