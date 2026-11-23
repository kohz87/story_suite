// The Bag with Text RPG: party.pc names the reader's character, so the shared bag is theirs and a worn piece counts on their sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, newHost, reply, sent, withAstra } from './helpers/host.js';

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
    const host = await withAstra({ 'story-block.gear': true });
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
