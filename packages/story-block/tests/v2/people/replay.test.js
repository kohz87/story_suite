// The people domain of a new chat (no flag) keeps "replay == live" (SPEC §2.2): writes across replies, swipes, last and middle deletes,
// a Re-read, a reload and store.rebuild(); at every carrier the oracle's rebuildAt equals the live state, and a Re-read keeps the write blocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../src/v2/persist.js';
import { carriers, rebuildAt } from '../qa/helpers/oracle.js';

const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)));
const writesOn = (chat, index) => (readRecord(chat[index])?.receipts ?? []).filter(receipt => receipt.type === 'people.write').length;

async function rig(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    return host;
}

// A view that changes with `n`: a new person now and then, a stage that moves, the turn counter.
function viewOf(n) {
    const ids = Array.from({ length: 1 + (n % 3) }, (_, i) => `npc_p${i}`);
    const npcs = Object.fromEntries(ids.map((id, i) => [id, { name: `Person ${i}`, stage: (n + i) % 4, note: n % 2 ? 'met' : 'seen' }]));
    return { v: 1, order: ids, npcs, candidates: n % 2 ? [] : [{ name: 'Wren' }], dismissed: [], userDismissedGroups: [], socialGraph: n > 2 ? { npc_p0: { npc_p1: 'friend' } } : {}, portraitAssets: {}, turn: n };
}
// What the sender does after a reply: write the view for the head's source.
async function mirror(host, n) {
    const source = host.store.sourceAt(host.store.headIndex());
    const result = await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view: viewOf(n) });
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
}
async function reply(host, n) {
    await host.send(`Turn ${n}.`, `Reply ${n}.`);
    await mirror(host, n);
}

// At every carrier on the line: the store's state equals the one the oracle rebuilds from the chat alone.
function assertReplay(host, label) {
    const chat = host.ctx.chat;
    for (const index of carriers(chat)) {
        const { state } = rebuildAt(chat, index);
        if (state === null) continue;
        assert.deepEqual(plain(host.store.at(index)), plain(state), `${label}: carrier ${index} rebuilt equals live`);
    }
    const head = host.store.headIndex();
    assert.deepEqual(plain(rebuildAt(chat, head).state.domains.people), plain(host.head().domains.people), `${label}: the head's people rebuilt equals live`);
}

test('replies: each write lands on its own carrier and the rebuilt state equals live at every carrier', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 6; n++) { await reply(host, n); assertReplay(host, `reply ${n}`); }
    assert.deepEqual(host.head().domains.people, viewOf(6));
    for (const index of carriers(host.ctx.chat).slice(1)) assert.equal(writesOn(host.ctx.chat, index), 1, `carrier ${index} holds its write`);   // (carrier 0 is the greeting)
});

test('swipes: a new swipe writes on its own carrier, swiping back restores the first, and the rebuild agrees both ways', async t => {
    const host = await rig(t);
    await reply(host, 1);
    await reply(host, 2);
    const last = host.store.headIndex();
    const first = plain(host.head().domains.people);
    await host.swipe('Another reply.');
    await mirror(host, 7);
    assert.deepEqual(host.head().domains.people, viewOf(7));
    assertReplay(host, 'new swipe');
    await host.st.swipeTo(last, 0);
    assert.deepEqual(plain(host.head().domains.people), first, 'swiping back shows the first swipe\'s people');
    assertReplay(host, 'swiped back');
    await host.st.swipeTo(last, 1);
    assert.deepEqual(host.head().domains.people, viewOf(7));
    assertReplay(host, 'swiped forward');
});

test('deletes: the last reply, then a middle reply; the rebuild equals live and the head keeps a whole people view', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 5; n++) await reply(host, n);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.deepEqual(host.head().domains.people, viewOf(4), 'the last delete falls back to the reply before');
    assertReplay(host, 'last delete');
    const middle = carriers(host.ctx.chat)[2];
    await host.st.deleteMessage(middle);
    assertReplay(host, 'middle delete');
    await reply(host, 8);
    assertReplay(host, 'a reply after the middle delete');
    assert.deepEqual(host.head().domains.people, viewOf(8));
});

test('Re-read keeps the write blocks of the reply and of the chat; the state is unchanged', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 3; n++) await reply(host, n);
    const index = host.store.headIndex();
    const before = plain(host.head());
    const blocks = carriers(host.ctx.chat).map(carrier => writesOn(host.ctx.chat, carrier));
    const done = await host.turn.reread(index);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(carriers(host.ctx.chat).map(carrier => writesOn(host.ctx.chat, carrier)), blocks, 'no write block was lost or added');
    assert.deepEqual(plain(host.head().domains.people), before.domains.people);
    assertReplay(host, 'after Re-read');
});

test('reload and store.rebuild(): the chat read again, and the store rebuilt, give the same people at every carrier', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 4; n++) await reply(host, n);
    const live = plain(host.head());
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.deepEqual(plain(host.head()), live, 'a reload gives the same head');
    assertReplay(host, 'reload');
    host.store.rebuild();
    assert.deepEqual(plain(host.head()), live, 'a rebuild gives the same head');
    assertReplay(host, 'rebuild');
    await reply(host, 5);
    assertReplay(host, 'a reply after the rebuild');
});

test('a mixed run: replies, swipe, delete, Re-read, reload, rebuild in turn; equality after every step', async t => {
    const host = await rig(t);
    await reply(host, 1); assertReplay(host, 's1');
    await reply(host, 2); assertReplay(host, 's2');
    await reply(host, 3); assertReplay(host, 's3');
    await host.swipe('Swiped.'); await mirror(host, 4); assertReplay(host, 'swipe');
    const done = await host.turn.reread(host.store.headIndex());
    assert.equal(done.ok, true, done.message);
    assertReplay(host, 're-read');
    await host.st.deleteMessage(carriers(host.ctx.chat)[1]); assertReplay(host, 'middle delete');
    await mirror(host, 5); assertReplay(host, 'next write');
    assert.deepEqual(host.head().domains.people, viewOf(5), 'the next write brings the head back');
    const again = await host.turn.reread(host.store.headIndex());
    assert.equal(again.ok, true, again.message);
    assertReplay(host, 're-read after the middle delete');
    await host.st.loadChat(structuredClone(host.ctx.chat)); assertReplay(host, 'reload');
    host.store.rebuild(); assertReplay(host, 'rebuild');
});

test('Re-read after a middle delete: a later write whose records an earlier deleted carrier made is skipped like any domain, and the Re-read is ok', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 3; n++) await reply(host, n);
    await host.st.deleteMessage(carriers(host.ctx.chat)[1]);
    assertReplay(host, 'middle delete');
    await mirror(host, 4);
    const done = await host.turn.reread(host.store.headIndex());
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(host.head().domains.people, viewOf(4));
    assertReplay(host, 'Re-read after a middle delete');
});

test('non-head Re-read after a middle delete, with a checkpoint after it: the Re-read leaves the skipped people block uncoded in the carried Problems, as a rebuild does; a later Re-read of an earlier reply stays ok', async t => {
    const host = await createHost({ storeOptions: { checkpointEvery: 3, checkpointBytes: 1 << 30 } });
    t.mock.method(console, 'warn', () => {});
    t.after(() => host.close());
    for (let n = 1; n <= 4; n++) await reply(host, n);
    await host.st.deleteMessage(carriers(host.ctx.chat)[1]);   // the earlier reply goes first; checkpoints are built after it
    const middle = carriers(host.ctx.chat)[2];
    const checkpointAfter = () => carriers(host.ctx.chat).find(index => index > middle && readRecord(host.ctx.chat[index])?.checkpoint);
    for (let n = 5; n <= 14 && checkpointAfter() === undefined; n++) await reply(host, n);
    const after = checkpointAfter();
    assert.ok(after !== undefined, 'a checkpoint record sits strictly after the Re-read reply');
    const ownReceipts = host.store.problems().filter(problem => problem.index === middle).flatMap(problem => problem.receipts);   // (the Problem of the Re-read reply's own people block)
    assert.ok(ownReceipts.length > 0, 'the Re-read reply has a skipped people block');
    const carriedFor = () => (readRecord(host.ctx.chat[after]).carried ?? []).filter(entry => entry.receipts.some(id => ownReceipts.includes(id)));
    const shape = () => ({ people: plain(host.head().domains.people), problems: plain(host.store.problems().map(({ index, code, why }) => ({ index, code, why }))) });
    assert.ok(readRecord(host.ctx.chat[after]).checkpoint, 'before the Re-read, the record after it is a checkpoint');
    const done = await host.turn.reread(middle);
    assert.equal(done.ok, true, done.message);
    assert.ok(readRecord(host.ctx.chat[after]).checkpoint, 'after the Re-read it is still a checkpoint');
    const entries = carriedFor();
    assert.ok(entries.length > 0, 'the checkpoint after the Re-read carries a Problem for the Re-read reply');
    for (const entry of entries) assert.equal(entry.code, undefined, 'no code on it, as the rebuild records it');
    const live = shape();
    host.store.rebuild();
    assert.deepEqual(shape(), live, 'live equals a plain rebuild (state, Problem codes)');
    assertReplay(host, 'after the Re-read');
    const earlier = carriers(host.ctx.chat)[1];
    const again = await host.turn.reread(earlier);
    assert.equal(again.ok, true, again.message);
    assert.deepEqual(host.store.reconcile(earlier, { rerun: () => ({ ok: false }) }).changed, false);
    const afterLive = shape();
    host.store.rebuild();
    assert.deepEqual(shape(), afterLive, 'live equals a rebuild after the later Re-read');
    assertReplay(host, 'after the later Re-read');
});
