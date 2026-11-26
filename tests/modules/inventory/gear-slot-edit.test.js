// The reader's Edit of the slot of gear the story gave: the slot alone, soak held to the new cap, worn pieces taken off, and replay equal to live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { fresh, reply, FIGHT } from './gear-inventory.helpers.js';
import { reload, clone } from '../../core/helpers/timeline.js';
import { STRINGS } from '../../../core/strings.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const DAGGER = 'Oak Stick Dagger';
const stackOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name)?.stack;
const defOf = (host, name) => Object.values(host.head().domains.inventory.defs).find(def => def.name === name);
const pieceOf = (host, name) => host.head().domains.inventory.stacks[stackOf(host, name)];
const edit = (host, name, payload) => host.sdk.command('inventory.edit', { stack: stackOf(host, name), ...payload });
const record = host => {
    const view = host.sdk.query('gear.view', {});
    return JSON.stringify([host.head().domains.inventory, view.rows, view.slots, host.sdk.query('gear.carry', {}).load]);
};
const indexOf = (host, text) => host.ctx.chat.findIndex(message => message.mes.includes(text));

async function story(t) {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', [`+ item ${DAGGER} | kind: off-hand | rarity: rare | DEX: 3 | soak: 2 | equipped: off-hand`]));
    return host;
}

async function same(t, host, label, problems = []) {
    const live = record(host);
    host.store.rebuild();
    assert.equal(record(host), live, `${label}: a rebuild equals live`);
    const cold = await reload(createHost, { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }, [FIGHT], SETTINGS);
    t.after(() => cold.close());
    assert.equal(record(cold), live, `${label}: a reload equals live`);
    assert.deepEqual(host.store.problems().map(problem => problem.code), problems, label);
}

test('slot alone moves a story piece: taken off, soak held to the new cap, rarity and bonus as given', async t => {
    const host = await story(t);
    assert.equal(pieceOf(host, DAGGER).equipped, 'off-hand');
    assert.equal(host.sdk.query('gear.view', {}).rows[stackOf(host, DAGGER)].slotEdit, true);
    const before = clone(defOf(host, DAGGER));
    const same_ = await edit(host, DAGGER, { slot: 'off-hand' });
    assert.equal(same_.ok, true, same_.message);
    assert.equal(pieceOf(host, DAGGER).equipped, 'off-hand', 'the same slot keeps it on');
    const out = await edit(host, DAGGER, { slot: 'head' });
    assert.equal(out.ok, true, out.message);
    assert.equal(pieceOf(host, DAGGER).equipped, null);
    const def = defOf(host, DAGGER);
    assert.deepEqual([def.slot, def.soak, def.kind, def.rarity, def.stats], ['head', 1, 'equipment', before.rarity, before.stats]);
    assert.equal((await edit(host, DAGGER, { slot: '' })).ok, true);
    assert.deepEqual([defOf(host, DAGGER).slot, defOf(host, DAGGER).soak], [null, undefined]);
    await same(t, host, 'no slot');
});

test('rarity, stats and kind of a story piece are still refused, alone or beside the slot', async t => {
    const host = await story(t);
    const before = record(host);
    for (const payload of [{ rarity: 'epic' }, { kind: 'goods' }, { slot: 'weapon', rarity: 'epic' }, { slot: 'weapon', kind: 'equipment' }, { slot: 'weapon', stats: { STR: 3 } }]) {
        const out = await edit(host, DAGGER, payload);
        assert.equal(out.ok, false, JSON.stringify(payload));
        assert.equal(out.message, STRINGS.editMessages.kitStory, JSON.stringify(payload));
    }
    assert.equal((await edit(host, DAGGER, { slot: 'elbow' })).ok, false);
    assert.equal(record(host), before);
});

test('later story lines never flip the reader\'s slot back, and swipe, rebuild and reload agree', async t => {
    const host = await story(t);
    assert.equal((await edit(host, DAGGER, { slot: 'weapon' })).ok, true);
    await host.send('More.', reply('Another one.', [`+ item ${DAGGER} | kind: off-hand | slot: off-hand`, `~ item ${DAGGER} | wear: torn`]));
    assert.equal(defOf(host, DAGGER).slot, 'weapon');
    await same(t, host, 'later lines');
    const last = host.ctx.chat.length - 1;
    await host.swipe(reply('Coins.', ['+ coin 2']));
    await same(t, host, 'swiped');
    await host.st.swipeTo(last, 0);
    await same(t, host, 'swiped back');
});

test('after None, a later `equipped:` line still wears the piece where it says, the same on a rebuild', async t => {
    const host = await story(t);
    assert.equal((await edit(host, DAGGER, { slot: '' })).ok, true);
    await host.send('More.', reply('Another one.', [`+ item ${DAGGER} | equipped: off-hand`]));
    assert.equal(defOf(host, DAGGER).slot, null);
    await same(t, host, 'equipped after None');
});

test('Re-read keeps a slot Edit that took a worn piece off, saved with a rename or a new count', async t => {
    for (const payload of [{ slot: 'weapon', name: 'Oak Dirk' }, { slot: 'weapon', qty: 2, group: true }]) {
        const host = await story(t);
        const out = await edit(host, DAGGER, payload);
        assert.equal(out.ok, true, out.message);
        await host.send('Later.', reply('Coins.', ['+ coin 5']));
        const live = record(host);
        const read = await host.turn.reread(indexOf(host, 'Gear one.'));
        assert.equal(read.ok, true, read.message);
        assert.equal(record(host), live, JSON.stringify(payload));
        await same(t, host, JSON.stringify(payload));
    }
});

test('a rebuild and a rewind past the Edit give the story\'s slot back', async t => {
    const host = await story(t);
    assert.equal((await edit(host, DAGGER, { slot: 'weapon' })).ok, true);
    const entry = host.sdk.receipts().find(each => each.receipt.type === 'inventory.edit');
    await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev });
    assert.deepEqual([defOf(host, DAGGER).slot, pieceOf(host, DAGGER).equipped], ['off-hand', 'off-hand']);
    await same(t, host, 'rewound');
});

test('a middle delete: of an unrelated reply the slot Edit stays; of the reply that gave the piece it is left off and reported', async t => {
    const host = await story(t);
    await host.send('Spare.', reply('Spare coins.', ['+ coin 1']));
    await host.send('On.', reply('The road on.', ['+ coin 2']));
    assert.equal((await edit(host, DAGGER, { slot: 'weapon' })).ok, true);
    await host.send('Later.', reply('Coins.', ['+ coin 5']));
    await host.st.deleteMessage(indexOf(host, 'Spare coins.'));
    assert.equal(defOf(host, DAGGER).slot, 'weapon');
    await same(t, host, 'unrelated delete');
    await host.st.deleteMessage(indexOf(host, 'Gear one.'));
    assert.equal(stackOf(host, DAGGER), undefined);
    await same(t, host, 'delete of the giving reply', ['REPLAY_PREREQUISITE']);
});

test('a story piece keeps its bonus through no slot and another slot', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', ['+ item Iron Guild Tag | kind: accessory | rarity: rare']));
    const tag = () => host.sdk.query('gear.view', {}).rows[stackOf(host, 'Iron Guild Tag')];
    const bonus = tag().bonus;
    assert.notEqual(bonus, '');
    for (const slot of ['', 'head', 'weapon']) {
        assert.equal((await edit(host, 'Iron Guild Tag', { slot })).ok, true);
        assert.equal(tag().bonus, slot ? bonus : '', slot);
    }
    await same(t, host, 'bonus kept');
});
