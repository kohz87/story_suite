// The Bag with Text RPG: party.pc names the reader's character, so the shared bag is theirs and a worn piece counts on their sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUY, astraOf, newHost, reply, sent, slice, withAstra } from './helpers/host.js';

test('party.pc is the reader\'s character, null with none or with Text RPG off', async t => {
    t.mock.method(console, 'warn', () => {});
    const empty = await newHost({ 'story-block.gear': true });
    const host = await withAstra({ 'story-block.gear': true });
    const off = await newHost({ 'text-rpg.on': false });
    t.after(() => { empty.close(); host.close(); off.close(); });
    assert.equal(empty.sdk.query('party.pc'), null);
    assert.deepEqual(host.sdk.query('party.pc'), { id: astraOf(host).id });
    assert.equal(off.sdk.query('party.pc'), null);
});

test('boots worn by the Text RPG character lift the sheet and the shared bag is theirs', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({ 'story-block.gear': true }, undefined, { stats: { ...BUY, agi: 9, dex: 5 } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    const word = async text => { await host.send(text, 'The road goes on.'); return /Astra \(Level 1\) — .*?AGI (\w+)/.exec(sent(host, 'story_suite_tail_1').at(-1))?.[1]; };
    const before = await word('Walk.');
    await host.send('Loot.', reply('Boots.', ['+ item Wolfhide Boots | slot: feet | +2 agi']));
    const stack = host.sdk.query('inventory.items').find(item => item.name === 'Wolfhide Boots').stack;
    const out = await host.sdk.command('inventory.equip', { stack });
    assert.equal(out.ok, true, out.message);
    assert.equal(host.sdk.query('gear.view', { id: astraOf(host).id }).slots.feet?.name, 'Wolfhide Boots');
    assert.equal(host.sdk.query('rpg.sheet').find(row => row.name === 'Astra').stats.AGI, 9, 'the sheet row is the base');
    const after = await word('Run.');
    assert.notEqual(after, before, `AGI word ${before} -> ${after}`);
});

test('a companion\'s own things and bag count in the load under their name, not their id', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({ 'story-block.gear': true });
    t.after(() => host.close());
    await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul', '+ item Leather Satchel']));
    const torka = Object.values(slice(host).members).find(member => member.name === 'Torka').id;
    const stackOf = () => host.sdk.query('inventory.items').find(item => item.name === 'Leather Satchel').stack;
    assert.equal((await host.sdk.command('inventory.carry', { stack: stackOf(), carry: 12 })).ok, true);
    const before = host.sdk.query('gear.view', {}).carry.capacity;
    // Counted before holding anything, so a first hand-over is held to their own limit; the reader's character is not a person, and is named on the chip.
    const [held] = host.sdk.query('gear.carry', {}).people;
    assert.deepEqual(host.sdk.query('gear.carry', {}).people.map(person => [person.id, person.name, person.load]), [[torka, 'Torka', 0]]);
    assert.deepEqual(host.sdk.query('gear.view', {}).carry.people, [], 'no line while they hold nothing');
    assert.match(host.sdk.query('gear.carry', { owner: torka, add: [{ qty: held.capacity + 1 }], move: true }).message, /^Torka cannot carry that: 0 of 30 carried/);
    assert.match(host.sdk.query('gear.view', {}).carry.breakdown, /^Astra carries \d+/);
    assert.equal((await host.sdk.command('inventory.bag', { owner: torka, stack: stackOf() })).ok, true);
    const [person] = host.sdk.query('gear.carry', {}).people;
    assert.deepEqual([person.id, person.name], [torka, 'Torka']);
    const carry = host.sdk.query('gear.view', {}).carry;
    // (the satchel's 12 left the shared bag, where it was held, and is theirs now: the party's total is the same)
    assert.deepEqual([carry.capacity, person.capacity], [before, held.capacity + 12]);
    assert.deepEqual(carry.people.map(row => row.name), ['Torka']);
    assert.match(carry.breakdown, /Torka carries \d+ · Torka's Leather Satchel \+12$/);
});
