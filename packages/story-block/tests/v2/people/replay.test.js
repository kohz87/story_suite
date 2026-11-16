// The people domain with its flag on keeps "replay == live" (SPEC §2.2): mirrors across replies, swipes, last and middle deletes,
// a Re-read, a reload and store.rebuild(); at every carrier the oracle's rebuildAt equals the live state, and a Re-read keeps the mirror blocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { FLAGS } from '../../../src/v2/flags.js';
import { readRecord } from '../../../src/v2/persist.js';
import { carriers, rebuildAt } from '../qa/helpers/oracle.js';

const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)));
const mirrorsOn = (chat, index) => (readRecord(chat[index])?.receipts ?? []).filter(receipt => receipt.type === 'people.mirror').length;

async function rig(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { flags: { [FLAGS.peopleInStore]: true } } });
    t.after(() => host.close());
    return host;
}

// A view that changes with `n`: a new person now and then, a stage that moves, the turn counter.
function viewOf(n) {
    const ids = Array.from({ length: 1 + (n % 3) }, (_, i) => `npc_p${i}`);
    const npcs = Object.fromEntries(ids.map((id, i) => [id, { name: `Person ${i}`, stage: (n + i) % 4, note: n % 2 ? 'met' : 'seen' }]));
    return { v: 1, order: ids, npcs, candidates: n % 2 ? [] : [{ name: 'Wren' }], dismissed: [], userDismissedGroups: [], socialGraph: n > 2 ? { npc_p0: { npc_p1: 'friend' } } : {}, portraitAssets: {}, turn: n };
}
// What the NSD mirror does after a publication: send the view for the head's source.
async function mirror(host, n) {
    const source = host.store.sourceAt(host.store.headIndex());
    const result = await host.sdk.command('people.mirror', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view: viewOf(n) });
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

test('replies: each mirror lands on its own carrier and the rebuilt state equals live at every carrier', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 6; n++) { await reply(host, n); assertReplay(host, `reply ${n}`); }
    assert.deepEqual(host.head().domains.people, viewOf(6));
    for (const index of carriers(host.ctx.chat).slice(1)) assert.equal(mirrorsOn(host.ctx.chat, index), 1, `carrier ${index} holds its mirror`);   // (carrier 0 is the greeting)
});

test('swipes: a new swipe mirrors on its own carrier, swiping back restores the first, and the rebuild agrees both ways', async t => {
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

test('Re-read keeps the mirror blocks of the reply and of the chat; the state is unchanged', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 3; n++) await reply(host, n);
    const index = host.store.headIndex();
    const before = plain(host.head());
    const blocks = carriers(host.ctx.chat).map(carrier => mirrorsOn(host.ctx.chat, carrier));
    const done = await host.turn.reread(index);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(carriers(host.ctx.chat).map(carrier => mirrorsOn(host.ctx.chat, carrier)), blocks, 'no mirror block was lost or added');
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
    // (A Re-read after a middle delete of an earlier mirror is a known gap: J07S2A.REPORT.md.)
    await host.st.deleteMessage(carriers(host.ctx.chat)[1]); assertReplay(host, 'middle delete');
    await mirror(host, 5); assertReplay(host, 'healed');
    assert.deepEqual(host.head().domains.people, viewOf(5), 'the next mirror brings the head back');
    await host.st.loadChat(structuredClone(host.ctx.chat)); assertReplay(host, 'reload');
    host.store.rebuild(); assertReplay(host, 'rebuild');
});

// Known gap, owned by J09 (J07S2A.REPORT.md "Finding"): not a failing test. The fuzz shard 5 keeps Re-read out of its mix until this is decided.
test.todo('Re-read of a reply that carries a mirror block, after a middle delete of an earlier carrier that created the people domain, refuses with "/domains/people/npcs/p0/stage does not exist (no people)" (repro: 3 replies each mirrored; delete carriers()[1]; mirror again at the head; host.turn.reread(headIndex) returns ok:false)');
