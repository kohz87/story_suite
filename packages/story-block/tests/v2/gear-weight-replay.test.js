// Replay equals live for load weights and the Bag Edit's weight and soak (Combat rules v1 C8b): swipe and back, middle delete, rewind, reload, Re-read plain, grown and shrunk, chat change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { fresh, reply, FIGHT } from './gear-inventory.helpers.js';
import { reload, clone } from './helpers/timeline.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const stackOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name)?.stack;
const edit = async (host, name, payload) => {
    const out = await host.sdk.command('inventory.edit', { stack: stackOf(host, name), ...payload });
    assert.equal(out.ok, true, out.message);
};
// Weights, load, the Edit form's rows (weight, own soak, cap) and the soak record.
const record = host => {
    const view = host.sdk.query('gear.view', {});
    const carry = host.sdk.query('gear.carry', {});
    return JSON.stringify([carry.weights, carry.load, Object.entries(view.rows).map(([id, row]) => [id, row.weight, row.soakOwn, row.soakMax]), view.soak, host.head().domains.inventory.defs]);
};
const indexOf = (host, text) => host.ctx.chat.findIndex(message => message.mes.includes(text));

// A plate and a rope the story gave, then the reader's Edits (the plate weighs 9 and soaks 2, the rope 0), then a later reply.
async function story(t) {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', ['+ item Iron Plate | slot: body']));
    await host.send('Loot.', reply('Gear two.', ['+ item Long Rope | qty: 3']));
    await edit(host, 'Iron Plate', { weight: 9, soak: 2 });
    await edit(host, 'Long Rope', { weight: 0 });
    await host.send('Later.', reply('Coins.', ['+ coin 5']));
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
    return live;
}
const loadOf = host => host.sdk.query('gear.carry', {}).load;

test('the reader\'s weights and soak count in load, and a rebuild and a reload say the same', async t => {
    const host = await story(t);
    assert.equal(loadOf(host), 9, 'plate 9, rope 3 × 0');
    assert.equal(host.sdk.query('gear.view', {}).rows[stackOf(host, 'Iron Plate')].soakOwn, 2);
    await same(t, host, 'start');
});

test('swipe, swipe back and a middle delete keep the weights equal to a rebuild and a reload', async t => {
    const host = await story(t);
    const start = await same(t, host, 'start');
    const last = host.ctx.chat.length - 1;
    await host.swipe(reply('Other coins.', ['+ coin 2']));
    await same(t, host, 'swiped');
    await host.st.swipeTo(last, 0);
    assert.equal(await same(t, host, 'swiped back'), start);
    // the middle delete: the reply the reader's Edits were made after goes, and they go with it
    await host.st.deleteMessage(indexOf(host, 'Gear two.'));
    await same(t, host, 'middle delete');
    assert.equal(stackOf(host, 'Long Rope'), undefined);
    assert.equal(loadOf(host), 5, 'both Edits were made after that reply and go with it: the plate weighs its body default');
});

test('rewind to before the reader\'s Edits gives the default weights back, as a rebuild says', async t => {
    const host = await story(t);
    const entry = host.sdk.receipts().find(each => each.receipt.type === 'inventory.edit');
    assert.ok(entry, 'the Edit was recorded');
    await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev });
    await same(t, host, 'rewound');
    assert.equal(loadOf(host), 5 + 3, 'the default weights: plate 5 (body), rope 3 × 1');
});

test('Re-read, plain, edited, grown and shrunk, of a reply whose pieces the reader did not Edit keeps the record equal to a rebuild and a reload', async t => {
    const host = await story(t);
    await host.send('Spare.', reply('A spare.', ['+ item Spare Shield | slot: off-hand']));
    await edit(host, 'Spare Shield', { weight: 1, soak: 1 });
    const at = indexOf(host, 'A spare.');
    const plain = await same(t, host, 'before');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(await same(t, host, 'plain re-read'), plain);
    for (const [label, lines] of [['edited', ['+ item Spare Shield | slot: off-hand', '+ coin 3']], ['grown', ['+ item Spare Shield | slot: off-hand', '+ item Steel Helm | slot: head']], ['shrunk', ['+ item Steel Helm | slot: head']]]) {
        host.ctx.chat[at].mes = reply('A spare.', lines);
        const out = await host.turn.reread(at);
        assert.equal(out.ok, true, `${label}: ${out.message}`);
        await same(t, host, label, label === 'shrunk' ? ['REPLAY_PREREQUISITE'] : []);
    }
    assert.equal(stackOf(host, 'Spare Shield'), undefined, 'the shield is gone and so is the Edit of it, which the guard reports');
});

test('Re-read of the reply that gave an Edited piece, changed: the Edit is left off and reported, and the record equals a rebuild and a reload', async t => {
    const host = await story(t);
    const at = indexOf(host, 'Gear one.');
    host.ctx.chat[at].mes = reply('Gear one.', ['+ item Iron Plate | slot: head']);
    const out = await host.turn.reread(at);
    assert.equal(out.ok, true, out.message);
    await same(t, host, 'changed', ['REPLAY_PREREQUISITE']);
});
