// What a reply laid out goes away with it (Story Block 2.6.1): timeline deletion, name matching, guard, and receipt ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { lootTakeGuard } from '../../modules/inventory/index.js';
import { hashJson } from '../../core/replay.js';
import { readRecord } from '../../core/persist.js';
import { agrees, at, claimed, coin, fresh, headSid, offPs, qty, reply, take } from './loot-undo.helpers.js';

// The earliest replies deleted (B-b2-timeline-3): the first reply left starts from the state they ended with, but what a
// deleted reply laid out goes with it, and a take of it does not stand, on the deleted reply or on a later one; the rest
// of what the deleted replies did is carried as before.
async function firstOffer(t, { later, checkpointEvery = null }) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost(checkpointEvery ? { storeOptions: { checkpointEvery } } : {});
    t.after(() => host.close());
    await host.send('Search the crate.', reply('A crate.', ['+ item Rope', '? loot Torch x2, 5 gold — in the crate']));
    const sid = headSid(host);
    if (later) await host.send('Walk on.', reply('The road goes on.', ['+ item Apple']));
    const taken = await take(host, sid, [0, 1]);
    assert.equal(taken.ok, true, taken.message);
    await host.send('More.', reply('Further on.', ['+ item Lamp']));
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid), qty(host, 'Rope')], [2, 5, true, 1]);
    return { host, sid };
}
// `rope`: the Rope the offering reply gave by its own line, carried when that reply was the first one left (1), gone with
// it when it was deleted from the middle (0).
function goneWithIt(host, sid, later, label, rope = 1) {
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid)], [0, 0, false], `${label}: the take went with its offer`);
    assert.equal(Object.hasOwn(host.head().domains.inventory.loot ?? {}, sid), false, `${label}: the offer went with its reply`);
    assert.deepEqual([qty(host, 'Rope'), qty(host, 'Lamp'), qty(host, 'Apple')], [rope, 1, later ? 1 : 0], `${label}: the rest is kept`);
}

for (const later of [false, true]) {
    const where = later ? 'a later reply' : 'the offering reply';
    for (const checkpointEvery of [null, 1]) {
        const with_ = checkpointEvery ? ' (a checkpoint on every reply)' : '';
        test(`a take on ${where}: the greeting deleted, then the offering reply: offer, take and claim go; the rest is carried${with_}`, async t => {
            const { host, sid } = await firstOffer(t, { later, checkpointEvery });
            await host.st.deleteMessage(0);
            assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid)], [2, 5, true], 'the greeting alone changes nothing');
            await host.st.deleteMessage(at(host, 'A crate.'));
            goneWithIt(host, sid, later, 'after the delete');
            if (checkpointEvery) assert.ok(readRecord(host.ctx.chat.find(message => !message.is_user && message.extra?.storySuite))?.checkpoint, 'the first reply left starts from a checkpoint');
            await agrees(t, host, 'after the delete');
        });
    }

    test(`a take on ${where}: the offering reply deleted, then the greeting (the other order)`, async t => {
        const { host, sid } = await firstOffer(t, { later });
        await host.st.deleteMessage(at(host, 'A crate.'));
        await host.st.deleteMessage(0);
        goneWithIt(host, sid, later, 'after the deletes', 0);
        await agrees(t, host, 'after the deletes');
    });

    test(`a take on ${where}: the greeting, the reader's message and then the offering reply deleted`, async t => {
        const { host, sid } = await firstOffer(t, { later });
        await host.st.deleteMessage(0);
        await host.st.deleteMessage(0);
        await host.st.deleteMessage(at(host, 'A crate.'));
        goneWithIt(host, sid, later, 'after the deletes');
        await agrees(t, host, 'after the deletes');
    });
}

test('the greeting deleted, the offering reply first and last: a swipe of it takes the offer and the take away', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Search the crate.', reply('A crate.', ['+ item Rope', '? loot Torch x2, 5 gold — in the crate']));
    const sid = headSid(host);
    assert.equal((await take(host, sid, [0, 1])).ok, true);
    await host.st.deleteMessage(0);
    await host.swipe(reply('An empty crate.', ['+ coin 1']));
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid), qty(host, 'Rope')], [0, 1, false, 0]);
    await agrees(t, host, 'on the other swipe');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid), qty(host, 'Rope')], [2, 5, true, 1]);
    await agrees(t, host, 'back on the first swipe');
});

// The offer's names are matched as the inventory looks a name up (names.js resolveDef): a Re-read that writes the taken
// thing another way still offers it; another thing, or a name that could mean two, does not.
for (const [first, again, keeps] of [
    ['Torch x2', 'Torches x2', true],
    ['Torches x2', 'Torch x2', true],
    ['Torch x2', 'TORCH   x2', true],
    ['Torch x2', 'a handful of Torches x2', true],
    ['Lantern Oil x2', 'Oil of Lantern x2', true],
    ['Torch x2', 'Torch Stand x2', false],
    ['Torch x2', 'Torches', false],
]) {
    test(`a take of "${first}" on a later reply, the offer Re-read as "${again}": ${keeps ? 'kept' : 'off'}`, async t => {
        const host = await fresh(t);
        await host.send('Search.', reply('A crate.', [`? loot ${first}, Rope — in the crate`]));
        const sid = headSid(host);
        await host.send('Walk on.', reply('The road goes on.', ['+ item Apple']));
        const taken = await take(host, sid, [0]);
        assert.equal(taken.ok, true, taken.message);
        const name = host.sdk.query('inventory.items').find(item => item.qty === 2)?.name;
        assert.ok(name);
        const index = at(host, 'A crate.');
        await host.st.editMessage(index, reply('A crate.', [`? loot ${again}, Rope — in the crate`]));
        assert.equal((await host.turn.reread(index)).ok, true);
        assert.deepEqual([qty(host, name), claimed(host, sid)], keeps ? [2, true] : [0, false]);
        assert.equal(offPs(host).length, keeps ? 0 : 1);
        await agrees(t, host, 'after the Re-read');
    });
}

test('the guard: the exact name wins; a name two things could mean, or two taken names meaning one thing, do not hold', () => {
    const guardOf = items => {
        const predicate = { kind: 'loot.take', sid: 'sw_000000000001', claim: 'loot:sw_000000000001', items, coin: 0 };
        return { owner: 'story-block', version: 2, epoch: 'ep_00000000', rulesHash: null, inputHash: hashJson(predicate), predicate };
    };
    const ask = (names, items) => {
        const offered = Object.fromEntries(names.map((name, n) => [String(n), { name, qty: 2 }]));
        const state = { v: 2, meta: { rev: 1, claims: {} }, domains: { inventory: { defs: {}, stacks: {}, wallets: {}, aliases: {},
            loot: { sw_000000000001: { sid: 'sw_000000000001', n: 1, where: '', claim: 'loot:sw_000000000001', items: offered } } } } };
        return lootTakeGuard({ state, hash: hashJson }, { guard: guardOf(items) });
    };
    assert.deepEqual(ask(['Torches', 'Torch'], [{ name: 'Torch', qty: 2 }]), { ok: true }, 'the exact name first');
    assert.deepEqual(ask(['Oil Lantern', 'Lanterns Oil'], [{ name: 'Lantern Oil', qty: 2 }]),
        { ok: false, reason: 'the loot on offer no longer holds Lantern Oil ×2 it took' }, 'two things the name could mean');
    assert.deepEqual(ask(['Oil Lantern'], [{ name: 'Lantern Oil', qty: 2 }]), { ok: true }, 'one thing it means');
    assert.equal(ask(['Torch'], [{ name: 'Torch', qty: 1 }, { name: 'Torches', qty: 1 }]).ok, false, 'one thing does not stand for two taken');
    assert.equal(ask(['Torch Stand'], [{ name: 'Torch', qty: 2 }]).ok, false, 'another thing');
    assert.equal(ask(['Torch'], [{ name: 'Torch', qty: 3 }]).ok, false, 'fewer than were taken');
    const bad = guardOf([{ name: 'Torch', qty: 2 }]);
    assert.deepEqual(lootTakeGuard({ state: {}, hash: hashJson }, { guard: { ...bad, inputHash: '0'.repeat(64) } }), { ok: false, reason: 'its loot guard is damaged' });
});

// Several leading replies removed in one update (SillyTavern's "delete messages" of a range), with a checkpoint among them: the
// first reply left starts from what they did, replayed whole from the first one's checkpoint, so the offer (reply-bound) and
// any take of it go even where a later checkpoint held them. What the deleted replies did otherwise is carried.
async function removeLeading(host, keep) {
    host.ctx.chat.splice(0, host.ctx.chat.length - keep);
    await host.st.eventSource.emit(host.st.ctx.eventTypes.MESSAGE_DELETED, host.ctx.chat.length);
}
async function bulk(t, { later, replies, checkpointEvery = null }) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost(checkpointEvery ? { storeOptions: { checkpointEvery } } : {});
    t.after(() => host.close());
    await host.send('Search the crate.', reply('A crate.', ['+ item Rope', '? loot Torch x2, 5 gold — in the crate']));
    const sid = headSid(host);
    if (!later) assert.equal((await take(host, sid, [0, 1])).ok, true);
    for (let n = 0; n < replies; n += 1) await host.send(`Step ${n}.`, reply(`Step ${n} goes on.`, ['+ coin 1']));
    if (later) assert.equal((await take(host, sid, [0, 1])).ok, true);
    await host.send('Last.', reply('The last reply.', ['+ item Lamp']));
    const marks = host.ctx.chat.filter(message => !message.is_user && readRecord(message)?.checkpoint).length;
    assert.ok(marks >= 2, `a checkpoint after the first one (${marks})`);
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid)], [2, 5 + replies, true]);
    return { host, sid };
}
for (const later of [false, true]) {
    const where = later ? 'a later reply that is left' : 'the offering reply';
    test(`a take on ${where}: the leading replies removed in one update past a checkpoint: offer, take and claim go`, async t => {
        const { host, sid } = await bulk(t, { later, replies: 6, checkpointEvery: 2 });
        // Keep the reply that holds a later take (and its reader's message), and the last one; else the last two replies.
        await removeLeading(host, 4);
        assert.deepEqual([qty(host, 'Torch'), claimed(host, sid)], [0, false]);
        assert.equal(Object.hasOwn(host.head().domains.inventory.loot ?? {}, sid), false, 'the offer went with its reply');
        assert.equal(qty(host, 'Rope'), 1, 'the deleted offering reply\'s own item is carried');
        assert.equal(qty(host, 'Lamp'), 1);
        assert.equal(coin(host), 6, 'the deleted replies\' coin is carried; the loot\'s 5 is not');
        assert.equal(offPs(host).length, later ? 1 : 0);
        await agrees(t, host, 'after the removal');
    });
}

test('a take on a later reply, 102 replies after the offer (the default checkpoint among them), the leading ones removed at once', async t => {
    const { host, sid } = await bulk(t, { later: true, replies: 102 });
    await removeLeading(host, 4);
    assert.deepEqual([qty(host, 'Torch'), claimed(host, sid), coin(host), qty(host, 'Rope')], [0, false, 102, 1]);
    assert.equal(offPs(host).length, 1);
    await agrees(t, host, 'after the removal');
});

// Another domain's scratch entry that happens to be keyed by a deleted reply's record ID is carried like any other state:
// only the loot offer is the reply's own (its reply-bound guard), nothing is dropped by key.
test('a scratch entry of another domain keyed by a deleted reply\'s record ID is carried, and a block built on it stays', async t => {
    t.mock.method(console, 'warn', () => {});
    const shared = () => ({
        id: 'zz-shared', name: 'Shared', version: '0.0.1',
        domains: { shared: { initial: () => ({ entries: {}, used: false }), scratch: ['entries'] } },
        commands: {
            'shared.put'(ctx, { key }) {
                ctx.draft('shared').entries[key] = { value: 7 };
                return { summary: 'Put.', narrate: false };
            },
            'shared.use'(ctx, { key }) {
                const draft = ctx.draft('shared');
                if (!draft.entries[key]) ctx.fail('NOT_FOUND', 'Nothing to use.');
                const predicate = { kind: 'use', key };
                ctx.replayGuard({ owner: 'zz-shared', version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash(predicate), predicate });
                draft.used = true;
                return { summary: 'Used.', narrate: false };
            },
        },
        hooks: {
            replayGuard: ({ state }, { guard }) => (state.domains.shared?.entries?.[guard.predicate.key]?.value === 7 ? { ok: true } : { ok: false, reason: 'the entry is gone' }),
        },
    });
    const host = await createHost({ modules: [shared()] });
    t.after(() => host.close());
    const key = headSid(host);
    assert.equal((await host.sdk.command('shared.put', { key })).ok, true, 'stored on the greeting, keyed by its record ID');
    await host.send('Hello.', reply('The road.', ['+ coin 1']));
    assert.equal((await host.sdk.command('shared.use', { key })).ok, true);
    await host.send('On.', reply('Further.', ['+ coin 1']));
    await host.st.deleteMessage(0);
    assert.deepEqual(host.head().domains.shared, { entries: { [key]: { value: 7 } }, used: true });
    assert.deepEqual(host.store.problems(), []);
    const live = structuredClone(host.head());
    host.store.rebuild();
    assert.deepEqual(host.head(), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [shared()], st: { chat: structuredClone(host.ctx.chat) } });
    t.after(() => loaded.close());
    assert.deepEqual(loaded.head(), live, 'a reload equals live');
});

test('a Re-read of an unchanged reply keeps the receipt that made each stack: stacks.<id>.from is equal', async t => {
    const host = await fresh(t);
    await host.send('Find things.', reply('You find things.', ['+ item Torch x2', '+ item Rope']));
    const index = at(host, 'You find things.');
    const froms = () => Object.fromEntries(Object.values(host.head().domains.inventory.stacks).map(stack => [stack.id, stack.from]));
    const before = froms();
    assert.ok(Object.keys(before).length >= 2 && Object.values(before).every(from => from !== ''), 'the stacks name their receipts');
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(froms(), before, 'the same stacks name the same receipts after a Re-read');
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(froms(), before, 'and after a second one');
    await agrees(t, host, 'after the Re-reads');
});

// A Re-read keeps each line's receipt id (SPEC §4.1): the ids of the lines that still read the same, in every shape of reply.
const receiptIds = (host, index) => host.ctx.chat[index].extra.storySuite.receipts.map(receipt => receipt.id);
const fromsOf = host => Object.fromEntries(Object.values(host.head().domains.inventory.stacks).map(stack => [stack.id, stack.from]));

test('a Re-read of an edited reply: the lines that read the same keep their receipt ids, a changed line gets a fresh one', async t => {
    const host = await fresh(t);
    await host.send('Find things.', reply('You find things.', ['+ item Torch x2', '+ item Rope']));
    const index = at(host, 'You find things.');
    const before = receiptIds(host, index);
    assert.equal(before.length, 2);
    await host.st.editMessage(index, reply('You find things.', ['+ item Torch x2', '+ item Lamp']));
    assert.equal((await host.turn.reread(index)).ok, true);
    const after = receiptIds(host, index);
    assert.equal(after[0], before[0], 'the unchanged line keeps its id');
    assert.notEqual(after[1], before[1], 'the changed line has a fresh id');
    assert.equal(new Set(after).size, 2, 'no id twice');
    const froms = fromsOf(host);
    assert.ok(Object.values(froms).every(from => after.includes(from)), 'every stack names a receipt the record holds');
    await agrees(t, host, 'after an edited Re-read');
});

test('a Continue, then a Re-read: the receipt ids of the first capture and of the Continue are kept, in order', async t => {
    const host = await fresh(t);
    await host.send('Find things.', reply('You find things.', ['+ item Torch x2']));
    await host.cont(' You linger.\n<Changes>\n+ item Rope\n</Changes>');
    const index = at(host, 'You find things.');
    const before = receiptIds(host, index);
    const froms = fromsOf(host);
    assert.equal(before.length, 2);
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(receiptIds(host, index), before);
    assert.deepEqual(fromsOf(host), froms);
    await agrees(t, host, 'Continue then Re-read');
});

test('a swipe away and back, then a Re-read: the shown swipe keeps its own receipt ids', async t => {
    const host = await fresh(t);
    await host.send('Find things.', reply('You find things.', ['+ item Torch x2', '+ item Rope']));
    const index = at(host, 'You find things.');
    const first = receiptIds(host, index);
    const froms = fromsOf(host);
    await host.swipe(reply('Nothing here.', ['+ coin 1']));
    const other = receiptIds(host, index);
    await host.st.swipeTo(index, 0);
    assert.deepEqual(receiptIds(host, index), first, 'back on the first swipe: its ids');
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(receiptIds(host, index), first, 'a Re-read keeps them');
    assert.deepEqual(fromsOf(host), froms);
    await host.st.swipeTo(index, 1);
    assert.deepEqual(receiptIds(host, index), other, 'the other swipe still has its own');
    await agrees(t, host, 'swipe away and back, then Re-read');
});
