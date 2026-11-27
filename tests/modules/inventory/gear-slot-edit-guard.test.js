// A Save with a new slot and a new name, and the replay guard of a slot Edit: every piece of the item is witnessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { fresh, reply, FIGHT } from './gear-inventory.helpers.js';
import { reload, clone } from '../../core/helpers/timeline.js';
import { fill, STRINGS } from '../../../core/strings.js';
import { hashJson } from '../../../core/replay.js';
import { inventoryEditGuard } from '../../../modules/inventory/edit-parts/guard.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const DAGGER = 'Oak Stick Dagger';
const inv = host => host.head().domains.inventory;
const stacksNamed = (host, name) => host.sdk.query('inventory.items').filter(item => item.name === name).map(item => item.stack);
const defNamed = (host, name) => Object.values(inv(host).defs).find(def => def.name === name);
const record = host => JSON.stringify([inv(host), host.sdk.query('gear.view', {}).rows]);
const indexOf = (host, text) => host.ctx.chat.findIndex(message => message.mes.includes(text));
const edit = (host, name, payload) => host.sdk.command('inventory.edit', { stack: stacksNamed(host, name)[0], ...payload });

async function story(t, ...lines) {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', lines));
    return host;
}

async function replays(t, host, label) {
    const live = record(host);
    host.store.rebuild();
    assert.equal(record(host), live, `${label}: a rebuild equals live`);
    const cold = await reload(createHost, { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }, [FIGHT], SETTINGS);
    t.after(() => cold.close());
    assert.equal(record(cold), live, `${label}: a reload equals live`);
    const read = await host.turn.reread(indexOf(host, 'Gear one.'));   // (the reply before the Edit: its guard is judged again)
    assert.equal(read.ok, true, read.message);
    assert.equal(record(host), live, `${label}: a Re-read equals live`);
    assert.deepEqual(host.store.problems(), [], label);
}

test('a new slot and a new name save together on one of two copies of story gear', async t => {
    const host = await story(t, `+ item ${DAGGER} | kind: off-hand | equipped: off-hand`, `+ item ${DAGGER} | kind: off-hand`);
    const out = await edit(host, DAGGER, { slot: 'weapon', name: 'Oak Dirk' });
    assert.equal(out.ok, true, out.message);
    assert.deepEqual([defNamed(host, 'Oak Dirk').slot, defNamed(host, DAGGER).slot], ['weapon', 'weapon']);
    await host.send('Later.', reply('Later reply.', ['+ coin 5']));
    await replays(t, host, 'shared');
});

test('a Save that takes a worn piece off cannot also join it to another item; one at a time it can', async t => {
    const host = await story(t, `+ item ${DAGGER} | kind: off-hand | equipped: off-hand`, '+ item Rope');
    const before = record(host);
    const out = await edit(host, DAGGER, { slot: 'weapon', name: 'Rope' });
    assert.equal(out.ok, false);
    assert.equal(out.message, fill(STRINGS.editMessages.itemWornMerge, { name: 'Rope' }));
    assert.equal(record(host), before);
});

test('the same refusal for the reader\'s own worn piece made plain goods under an existing name', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', ['+ item Rope']));
    assert.equal((await host.sdk.command('inventory.add', { name: 'My Stick', kind: 'equipment', slot: 'weapon' })).ok, true);
    assert.equal((await host.sdk.command('item.equip', { stack: stacksNamed(host, 'My Stick')[0], slot: 'weapon' })).ok, true);
    const out = await edit(host, 'My Stick', { kind: 'goods', name: 'Rope' });
    assert.equal(out.ok, false);
    assert.equal(out.message, fill(STRINGS.editMessages.itemWornMerge, { name: 'Rope' }));
});

test('a Re-read of another reply that changes the item\'s pieces leaves the slot Edit off and says so', async t => {
    const host = await story(t, `+ item ${DAGGER} | kind: off-hand | soak: 2`);
    await host.send('Mid.', reply('Gear two.', ['+ coin 1']));
    assert.equal((await edit(host, DAGGER, { slot: 'weapon' })).ok, true);
    await host.send('Later.', reply('Later reply.', ['+ coin 5']));
    const at = indexOf(host, 'Gear two.');
    host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('+ coin 1', `+ item ${DAGGER} | equipped: off-hand`);
    const read = await host.turn.reread(at);
    assert.equal(read.ok, true, read.message);
    assert.equal(defNamed(host, DAGGER).slot, 'off-hand');
    assert.equal(Object.values(inv(host).stacks).filter(item => item.equipped === 'off-hand').length, 1);
    const problems = host.store.problems();
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.ok(problems[0].message.includes(STRINGS.editMessages.itemPiecesChanged), problems[0].message);
    const live = record(host);
    host.store.rebuild();
    assert.equal(record(host), live);
});

test('a guard saved without the pieces of a slot Edit is judged as before; with them, a bound or worn change fails it', () => {
    const piece = { id: 'a', def: 'story/x', owner: 'party', equipped: null };
    const state = { domains: { inventory: { defs: { 'story/x': {} }, stacks: { a: piece } } } };
    const operation = { type: 'inventory.edit', payload: { stack: 'a', slot: 'head' } }, source = { index: 1 };
    const judge = extra => {
        const predicate = { kind: 'inventory.reader-edit', action: 'inventory.edit', target: { id: 'a', def: 'story/x', owner: 'party' }, ...extra };
        return inventoryEditGuard({ state, hash: hashJson }, { guard: { owner: 'story-block', version: 2, rulesHash: null, inputHash: hashJson({ predicate, source }), predicate }, source, operation });
    };
    assert.deepEqual(judge({}), { ok: true });
    const slotPieces = hashJson([{ id: 'a', owner: 'party', equipped: null, bound: null }]);
    assert.deepEqual(judge({ slotPieces }), { ok: true });
    piece.bound = 'npc_mara';
    assert.equal(judge({ slotPieces }).ok, false);
    assert.deepEqual(judge({}), { ok: true });
});
