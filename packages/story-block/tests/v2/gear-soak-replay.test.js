// Replay equals live for soak and carry weights (Combat rules v1 C8): swipe and back, middle delete, rewind, reload, Re-read plain, grown and shrunk, chat change; and coins weigh nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { fresh, reply, equip, FIGHT, ON } from './gear-inventory.helpers.js';
import { reload, clone } from '../../../../tests/core/helpers/timeline.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const record = host => JSON.stringify([host.sdk.query('gear.view', {}).soak, host.sdk.query('inventory.gear', { owner: 'party' }).soak, host.sdk.query('gear.carry', {}).weights, host.sdk.query('gear.carry', {}).load, host.sdk.query('gear.view', {}).bag.map(entry => [entry.name, entry.soak])]);
const soakTotal = host => host.sdk.query('inventory.gear', { owner: 'party' }).soak.total;
const indexOf = (host, text) => host.ctx.chat.findIndex(message => message.mes.includes(text));

// Plate (soak 2) and cap (soak 1) worn; the plate is torn by the third reply; a coin reply last.
async function story(t) {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear one.', ['+ item Iron Plate | slot: body | soak: 2']));
    await host.send('Loot.', reply('Gear two.', ['+ item Oak Cap | slot: head | soak: 1']));
    for (const name of ['Iron Plate', 'Oak Cap']) await equip(host, name);
    await host.send('Fight.', reply('A blow.', ['~ hit body 3']));
    await host.send('Pay.', reply('Coins.', ['+ coin 5']));
    return { host };
}

// What every path must hold: the live record equals a fresh rebuild and a cold host loaded from the saved chat.
async function same(t, host, label) {
    const live = record(host);
    host.store.rebuild();
    assert.equal(record(host), live, `${label}: a rebuild equals live`);
    const cold = await reload(createHost, { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }, [FIGHT], SETTINGS);
    t.after(() => cold.close());
    assert.equal(record(cold), live, `${label}: a reload equals live`);
    assert.deepEqual(host.store.problems(), [], label);
    return live;
}

test('the torn plate gives none while the cap does; load is the sum of the weights', async t => {
    const { host } = await story(t);
    assert.equal(soakTotal(host), 1);
    const carry = host.sdk.query('gear.carry', {});
    assert.equal(carry.load, Object.values(carry.weights).reduce((sum, n) => sum + n, 0), 'load is the sum of the weights');
});

test('swipe, swipe back, middle delete and rewind keep the soak record equal to a rebuild and a reload', async t => {
    const { host } = await story(t);
    const torn = await same(t, host, 'start');
    const last = host.ctx.chat.length - 1;
    await host.swipe(reply('Other coins.', ['+ coin 2']));
    await same(t, host, 'swiped');
    await host.st.swipeTo(last, 0);
    assert.equal(await same(t, host, 'swiped back'), torn);
    // the middle delete: the reply that tore the plate goes, so it is worn but whole again (soak 2 + 1)
    await host.st.deleteMessage(indexOf(host, 'A blow.'));
    await same(t, host, 'middle delete');
    assert.equal(soakTotal(host), 3);
});

test('rewind to before the tearing reply gives the plate\'s soak back, as a rebuild says', async t => {
    const { host } = await story(t);
    const entry = host.sdk.receipts().find(each => each.receipt.type === 'gear.wear' || /wear|hit/.test(each.receipt.type));
    assert.ok(entry, 'the wear was recorded');
    await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev });
    await same(t, host, 'rewound');
    assert.equal(soakTotal(host), 3);
});

test('Re-read, plain, edited up, grown and shrunk, of a reply whose pieces are in the bag keeps the record equal to a rebuild and a reload', async t => {
    const { host } = await story(t);
    await host.send('Spare.', reply('A spare.', ['+ item Spare Shield | slot: off-hand | soak: 2']));
    const at = indexOf(host, 'A spare.');
    const plain = await same(t, host, 'before');
    assert.equal(JSON.parse(plain)[4].some(([name, soak]) => name === 'Spare Shield' && soak === 2), true, 'the bag shows the shield\'s soak');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(await same(t, host, 'plain re-read'), plain);
    for (const [label, lines] of [['edited down', ['+ item Spare Shield | slot: off-hand | soak: 1']], ['grown', ['+ item Spare Shield | slot: off-hand | soak: 1', '+ item Steel Helm | slot: head | soak: 2']], ['shrunk', ['+ item Steel Helm | slot: head | soak: 2']], ['no soak word', ['+ item Steel Helm | slot: head']]]) {
        host.ctx.chat[at].mes = reply('A spare.', lines);
        const out = await host.turn.reread(at);
        assert.equal(out.ok, true, out.message);
        await same(t, host, label);
    }
    assert.deepEqual(JSON.parse(record(host))[4].map(([name, soak]) => [name, soak]).filter(([name]) => name === 'Steel Helm'), [['Steel Helm', 0]]);
});

test('with Gear off the soak answers are as before: no soak in gear queries', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [FIGHT], settings: {} });
    t.after(() => host.close());
    await host.send('Loot.', reply('Gear one.', ['+ item Iron Plate | slot: body | soak: 2']));
    assert.equal(Object.values(host.head().domains.inventory.defs).some(item => item.soak !== undefined), false);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }) ?? null, null);
    assert.equal(ON.extra.feature('story-block.gear'), true);
});
