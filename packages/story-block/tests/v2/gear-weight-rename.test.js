// One Save that renames a piece and sets its Weight or Soak (Combat rules v1 C8b): the rename's guard holds, and the numbers land on the def the piece ends up on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reply, wear, defNamed } from './gear-inventory.helpers.js';
import { world } from './gear-start.helpers.js';
import { reload, clone } from './helpers/timeline.js';
import { createHost } from '../../testkit/index.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const edit = (host, name, payload) => host.sdk.command('inventory.edit', { stack: wear(host, name).stack, ...payload });
const defs = host => JSON.stringify(host.head().domains.inventory.defs);

async function same(t, host, label) {
    const live = defs(host);
    host.store.rebuild();
    assert.equal(defs(host), live, `${label}: a rebuild equals live`);
    const cold = await reload(createHost, { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }, [], SETTINGS);
    t.after(() => cold.close());
    assert.equal(defs(cold), live, `${label}: a reload equals live`);
    assert.deepEqual(host.store.problems().map(problem => problem.code), [], label);
}

test('a pack piece renamed in the same Save as its Weight and Soak: stored, the copy carries the weight and the reader\'s soak, the pack\'s def is untouched', async t => {
    const host = await world(t, { packs: true, items: [{ name: 'Pack Cap', kind: 'equipment', slot: 'head', weight: 3 }] });
    await host.send('Go.', reply('Loot.', ['+ item Pack Cap']));
    const out = await edit(host, 'Pack Cap', { name: 'My Cap', weight: 7, soak: 1 });
    assert.equal(out.ok, true, out.message);
    assert.deepEqual([defNamed(host, 'My Cap').weight, defNamed(host, 'My Cap').soak], [7, 1]);
    assert.deepEqual([defNamed(host, 'Pack Cap').weight, defNamed(host, 'Pack Cap').soak], [3, undefined]);
    await same(t, host, 'pack rename + numbers');
});

test('an item with two pieces renamed with a Weight or Soak in one Save: stored, and only the renamed piece\'s def has the numbers', async t => {
    const host = await world(t);
    await host.send('Go.', reply('Loot.', ['+ item Iron Cap | slot: head | qty: 2']));
    const out = await edit(host, 'Iron Cap', { name: 'Odd Cap', weight: 6, soak: 1 });
    assert.equal(out.ok, true, out.message);
    assert.deepEqual([defNamed(host, 'Odd Cap').weight, defNamed(host, 'Odd Cap').soak], [6, 1]);
    assert.deepEqual([defNamed(host, 'Iron Cap').weight, defNamed(host, 'Iron Cap').soak], [undefined, undefined]);
    await same(t, host, 'two pieces rename + numbers');
});

test('renaming onto an existing item with a Weight in one Save puts the weight on the item the piece now is', async t => {
    const host = await world(t);
    await host.send('Go.', reply('Loot.', ['+ item Stone | qty: 2', '+ item Rock | qty: 1']));
    const out = await edit(host, 'Stone', { name: 'Rock', weight: 9 });
    assert.equal(out.ok, true, out.message);
    assert.equal(defNamed(host, 'Rock').weight, 9);
    assert.equal(defNamed(host, 'Stone').weight, undefined, 'the old def is not where the number went');
    await same(t, host, 'merge + weight');
});

test('a count (group) with a Weight and no rename still sets the weight', async t => {
    const host = await world(t);
    await host.send('Go.', reply('Loot.', ['+ item Iron Cap | slot: head | qty: 2']));
    const out = await edit(host, 'Iron Cap', { group: true, qty: 3, weight: 4 });
    assert.equal(out.ok, true, out.message);
    assert.equal(defNamed(host, 'Iron Cap').weight, 4);
    await same(t, host, 'group + weight');
});
