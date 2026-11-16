// The third review of the replay core (docs/v2/REPLAY.md): revs strictly increasing across a Re-read, boundaries that follow
// a Re-read whose step comes out the same, a classifier that fails closed on the fallback path, repairs that keep every
// preserved record, tombstones with a baseline per chat, and quarantined records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { Q1, Q2, guarded, harness } from './helpers/guarded.js';
import { clone, inOrder, receiptRevsOf, revsOf, setStory } from './replay-review3.helpers.js';

test('F: revs stay strictly increasing and unique across the chat after a Re-read, with no step planned again', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 30\n</Changes>');
    const first = host.ctx.chat.length - 1;
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 1 }, { cause: 'ui' });
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 1 }, { cause: 'ui' });
    setStory(host, first, 'Dawn.\n\n<Changes>\n! tick 30\n! tick 31\n! tick 32\n</Changes>');
    const done = await host.turn.reread(first);
    assert.equal(done.ok, true, done.message);
    const revs = revsOf(host);
    assert.ok(inOrder(revs), `op revs ${revs}`);
    const receipts = receiptRevsOf(host);
    assert.ok(inOrder(receipts), `receipt revs ${receipts}`);
    assert.equal(host.head().meta.rev, revs.at(-1), 'the head is at the last rev');
    const live = JSON.stringify(host.head());
    await host.st.loadChat(clone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), live);
});

test('B: a Re-read whose later step comes out the same still records where that step now stands', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', `Dawn.\n\n<Changes>\n! offer ${Q1}\n</Changes>`);
    const first = host.ctx.chat.length - 1;
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 1 }, { cause: 'ui' });
    assert.deepEqual(host.store.boundaryProblems(), []);
    const before = host.head().domains.gt.credits[Q1];
    setStory(host, first, `Dawn.\n\n<Changes>\n! offer ${Q2}\n</Changes>`);
    const done = await host.turn.reread(first);
    assert.equal(done.ok, true, done.message);
    assert.equal(host.head().domains.gt.credits[Q1], before, 'the attempt came out the same');
    assert.equal(host.head().domains.gt.quests[Q2].state, 'open');
    assert.deepEqual(host.store.boundaryProblems(), [], 'its recorded prefix is what the chat now gives');
    // And it is what a reload sees.
    const live = JSON.stringify(host.head());
    await host.st.loadChat(clone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), live);
    assert.deepEqual(host.store.boundaryProblems(), []);
});

test('A: a block whose spans are gone stands for every receipt it merges: one guarded receipt among them keeps it off', () => {
    for (const [label, strip] of [
        ['no spans', record => { delete record.spans; }],
        ['spans that do not add up', record => { record.spans = record.spans.map(span => ({ n: span.n + 1, story: span.story })); }],
        ['spans cut down to n and story', record => { record.spans = [{ n: record.ops.length, story: false }]; }],
    ]) {
        const mode = { value: 'normal' };
        const h = harness([guarded({ mode })]);
        const at = h.send('u', 'r');
        assert.equal(h.command('gt.quick', { id: Q1 }).ok, true, label);
        assert.equal(h.command('gt.hit', { actor: 'ac_00000001', amount: 2 }).ok, true, label);
        assert.equal(h.gt().coin, 1, label);
        strip(h.record(at));
        // The guard cannot say yes any more: the merged block is not applied, and it says so (the unguarded hit is one of its parts).
        mode.value = 'throw';
        h.store.rebuild();
        assert.equal(h.gt().coin, 0, `${label}: the coin is not paid`);
        assert.ok(h.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE'), label);
        // Without a guarded receipt nothing changes: the same merge of plain commands replays as it always did.
        const plain = harness([guarded({ mode })]);
        const there = plain.send('u', 'r');
        plain.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
        plain.command('gt.hit', { actor: 'ac_00000001', amount: 2 });
        strip(plain.record(there));
        plain.store.rebuild();
        assert.equal(plain.gt().lost.ac_00000001, 3, `${label}: plain commands are applied`);
        assert.deepEqual(plain.problems(), [], label);
    }
});

test('A: the same on a Re-read: a kept guarded block among merged receipts is asked, and the checkpoints after it follow', () => {
    const mode = { value: 'normal' };
    const h = harness([guarded({ mode })], { checkpointEvery: 3, checkpointBytes: 1 << 30 });
    const at = h.send('u', 'r');
    assert.equal(h.command('gt.quick', { id: Q1 }).ok, true);
    assert.equal(h.command('gt.hit', { actor: 'ac_00000001', amount: 2 }).ok, true);
    for (let n = 0; n < 5; n++) {
        h.send(`u${n}`, `r${n}`);
        h.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
    }
    const record = h.record(at);
    record.spans = [{ n: record.ops.length, story: false }];
    mode.value = 'throw';
    h.store.rebuild();
    assert.equal(h.gt().coin, 0);
    const checkpoints = () => h.chat.map(message => message.extra?.storySuite).filter(each => each?.checkpoint && each.sid !== h.record(0)?.sid).map(each => each.checkpoint.domains.gt.coin);
    h.store.replaceStory(at, { ops: [] });
    assert.equal(h.gt().coin, 0, 'still off after the Re-read');
    assert.ok(checkpoints().every(coin => coin === 0), `no checkpoint holds the coin: ${checkpoints()}`);
    assert.equal(h.gt().lost.ac_00000001, 5, 'the plain hits after it are still there (the merged block took its own hit with it)');
});

test('C: every record a repair sets aside survives any number of repairs', () => {
    const v1 = { v: 1, state: { gold: 99 } };
    const h = harness([guarded()]);
    h.chat.length = 0;
    h.chat.push({ is_user: false, is_system: false, mes: 'Hi.', swipe_id: 0, swipes: ['Hi.'], extra: { storySuite: clone(v1) } });
    h.store.rebuild();
    h.store.ensureInitial(h.registry.initialState());
    assert.equal(h.store.readOnly().kind, 'legacy');
    h.store.startOver({ confirmed: true });
    assert.equal(h.store.readOnly(), null);
    assert.deepEqual(h.chat[0].extra.storySuiteAside, [{ kind: 'legacy', record: v1 }]);
    // The replacement is damaged later; the reader starts over again.
    const damaged = { v: 2, sid: 'sw_damaged0001', ops: 'x', receipts: [], narrated: [] };
    h.chat[0].extra.storySuite = clone(damaged);
    h.store.rebuild();
    h.store.ensureInitial(h.registry.initialState());
    assert.equal(h.store.readOnly().kind, 'damaged');
    h.store.startOver({ confirmed: true });
    assert.deepEqual(h.chat[0].extra.storySuiteAside, [{ kind: 'legacy', record: v1 }, { kind: 'damaged', record: damaged }], 'the first one is still there');
    // And a third time.
    const worse = { v: 1, state: { gold: 1 } };
    h.chat[0].extra.storySuite = clone(worse);
    h.store.rebuild();
    h.store.ensureInitial(h.registry.initialState());
    h.store.startOver({ confirmed: true });
    assert.deepEqual(h.chat[0].extra.storySuiteAside.map(entry => entry.record), [v1, damaged, worse]);
    // A list from before (one record, as a single value) is kept too.
    h.chat[0].extra.storySuiteAside = clone(v1);
    h.chat[0].extra.storySuite = clone(damaged);
    h.store.rebuild();
    h.store.ensureInitial(h.registry.initialState());
    h.store.startOver({ confirmed: true });
    assert.deepEqual(h.chat[0].extra.storySuiteAside, [{ kind: 'earlier', record: v1 }, { kind: 'damaged', record: damaged }]);
    // An array that is not a list of our entries (records from before) is one earlier record as a whole, not taken for the list.
    const before = [{ v: 1 }, 'x', { kind: 'legacy' }];
    h.chat[0].extra.storySuiteAside = clone(before);
    h.chat[0].extra.storySuite = clone(damaged);
    h.store.rebuild();
    h.store.ensureInitial(h.registry.initialState());
    h.store.startOver({ confirmed: true });
    assert.deepEqual(h.chat[0].extra.storySuiteAside, [{ kind: 'earlier', record: before }, { kind: 'damaged', record: damaged }]);
});

test('D: a store opened over saved records knows their ids from its first rebuild, and one chat\'s ids never reach another\'s archive', () => {
    const made = (metadata, base = 0) => {
        let n = base;
        const h = harness([guarded()], { metadata: () => metadata, recordId: () => `sw_${(++n).toString(16).padStart(12, '0')}` });
        const at = [];
        for (let n = 1; n <= 3; n++) {
            at.push(h.send(`u${n}`, `r${n}`));
            h.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
        }
        return { h, at };
    };
    const { h: source, at } = made({});
    const saved = clone(source.chat);
    const goneIds = ['logical', 'swipeKey', 'evidence'].map(name => source.record(at[1]).source[name]);
    // Opened over the saved chat: rebuilt once, then a reply is deleted before anything is written.
    const meta = {};
    const opened = harness([guarded()], { metadata: () => meta });
    opened.chat.splice(0, opened.chat.length, ...clone(saved));
    opened.store.rebuild();
    opened.chat.splice(at[1] - 1, 2);
    opened.store.rebuild();
    for (const id of goneIds) assert.equal(opened.store.archived(id), true, `${id} is archived`);
    assert.ok(goneIds.every(id => meta.storySuite.sourceArchive.deleted.includes(id)));

    // Two chats in the one array: the first chat's ids are not put in the second's archive.
    let chatId = 'a';
    const metas = { a: {}, b: {} };
    const two = harness([guarded()], { chatId: () => chatId, metadata: () => metas[chatId] });
    two.chat.splice(0, two.chat.length, ...clone(saved));
    two.store.rebuild();
    const other = made({}, 0x500);
    chatId = 'b';
    two.chat.splice(0, two.chat.length, ...clone(other.h.chat));
    two.store.rebuild();
    assert.deepEqual(two.store.archiveList(), [], 'nothing was deleted from the second chat');
    assert.equal(metas.b.storySuite, undefined, 'and its metadata holds nothing of the first');
    const own = ['logical', 'swipeKey', 'evidence'].map(name => two.record(other.at[1]).source[name]);
    two.chat.splice(other.at[1] - 1, 2);
    two.store.rebuild();
    assert.deepEqual(two.store.archiveList(), [...own].sort(), 'only the second chat\'s own ids');
    assert.equal(goneIds.some(id => two.store.archived(id)), false);
});

test('F+A: a merged block renumbered by a Re-read keeps every receipt tied to its ops, so its guarded receipt still holds it off', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 30\n</Changes>');
    const first = host.ctx.chat.length - 1;
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.quick', { id: Q1 }, { cause: 'ui' });
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 2 }, { cause: 'ui' });
    const later = host.ctx.chat.length - 1;
    assert.equal(host.head().domains.gt.coin, 1);
    const record = host.ctx.chat[later].extra.storySuite;
    delete record.spans;
    host.store.rebuild();
    assert.equal(host.head().domains.gt.coin, 0, 'stripped: off');
    setStory(host, first, 'Dawn.\n\n<Changes>\n! tick 30\n! tick 31\n! tick 32\n</Changes>');
    const done = await host.turn.reread(first);
    assert.equal(done.ok, true, done.message);
    const stored = host.ctx.chat[later].extra.storySuite;
    const opRevs = stored.ops.filter(op => op.path === '/meta/rev').map(op => op.value);
    assert.deepEqual(stored.receipts.map(receipt => receipt.rev), opRevs, 'every receipt still names its own ops');
    assert.ok(inOrder(receiptRevsOf(host)), `receipt revs ${receiptRevsOf(host)}`);
    assert.equal(host.head().domains.gt.coin, 0, 'still off after the Re-read');
    assert.ok(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE'));
    await host.st.loadChat(clone(host.ctx.chat));
    assert.equal(host.head().domains.gt.coin, 0, 'and after a reload');
});

test('F+A: a guarded receipt that names no ops of its record keeps the record\'s plain blocks off too (a record an older build renumbered)', () => {
    const h = harness([guarded()]);
    const at = h.send('u', 'r');
    h.command('gt.quick', { id: Q1 });
    h.command('gt.hit', { actor: 'ac_00000001', amount: 2 });
    const record = h.record(at);
    record.spans = [{ n: record.ops.length, story: false }];
    record.receipts[0].rev = 99;       // detached from every op
    h.store.rebuild();
    assert.equal(h.gt().coin, 0);
    assert.equal(h.gt().lost.ac_00000001, undefined);
    assert.ok(h.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE' && /guarded receipt/.test(problem.why)));
});

test('F+A: taking back a guarded change leaves the plain ones before it applied (its dropped receipt is not an orphan)', () => {
    const h = harness([guarded()]);
    const at = h.send('u', 'r');
    h.command('gt.hit', { actor: 'ac_00000001', amount: 2 });
    h.command('gt.quick', { id: Q1 });
    assert.equal(h.gt().coin, 1);
    const result = h.store.truncate(at, 2);
    assert.equal(result.dropped.length, 1);
    assert.equal(h.gt().lost.ac_00000001, 2, 'the hit before it stays');
    assert.equal(h.gt().coin, 0);
    assert.deepEqual(h.problems(), []);
});

test('Q: a record with an orphaned guarded receipt applies nothing: intact spans too, no replan, and it cannot be cut down', () => {
    // Intact metadata: the quick keeps its span and guard, the receipt of the hit is the one detached.
    const h = harness([guarded()]);
    const at = h.send('u', 'r');
    h.command('gt.quick', { id: Q1 });
    h.command('gt.hit', { actor: 'ac_00000001', amount: 2 });
    assert.equal(h.gt().coin, 1);
    h.record(at).receipts[0].rev = 99;
    h.store.rebuild();
    assert.equal(h.gt().coin, 0, 'the quick has its span and passes its guard, but its record is quarantined');
    assert.equal(h.gt().lost.ac_00000001, undefined, 'and so is the hit');
    assert.ok(h.problems().every(problem => problem.code === 'REPLAY_PREREQUISITE'));
    assert.ok(h.problems().length >= 2);
    // A rewind / truncate refuses; it does not keep the ops it cannot tell apart.
    const before = JSON.stringify(h.record(at));
    assert.throws(() => h.store.truncate(at, 2), /cannot be cut down/);
    assert.throws(() => h.store.truncate(at, 2, { dryRun: true }), /cannot be cut down/);
    assert.equal(JSON.stringify(h.record(at)), before, 'nothing was written');
    // A Re-read of it does not read it again either.
    assert.throws(() => h.store.replaceStory(at, { ops: [], receipts: [] }), /not read again/);
    // The stripped-span case of the report: truncate cannot bring the coin back.
    const g = harness([guarded()]);
    const there = g.send('u', 'r');
    g.command('gt.quick', { id: Q1 });
    g.command('gt.hit', { actor: 'ac_00000001', amount: 2 });
    delete g.record(there).spans;
    g.record(there).receipts[0].rev = 99;
    g.store.rebuild();
    assert.equal(g.gt().coin, 0);
    assert.throws(() => g.store.truncate(there, 2), /cannot be cut down/);
    assert.equal(g.gt().coin, 0);
    const reloaded = harness([guarded()]);
    reloaded.chat.splice(0, reloaded.chat.length, ...clone(g.chat));
    reloaded.store.rebuild();
    assert.equal(reloaded.gt().coin, 0, 'and after a reload');
});

test('Q: a quarantined record later in the chat is not planned again by a reconcile', () => {
    const h = harness([guarded()]);
    h.send('u', 'r');
    h.command('gt.tick', { minutes: 90 });
    const at = h.send('u2', 'r2');
    h.command('gt.attempt', { id: Q1 }, 'system');
    const record = h.record(at);
    record.receipts[0].rev = 99;
    h.store.rebuild();
    assert.equal(h.gt().credits[Q1], undefined, 'the attempt is not applied');
    let asked = 0;
    h.store.reconcile(0, { rerun: () => { asked += 1; return { ok: false }; } });
    assert.equal(asked, 0, 'a quarantined step is not asked again');
});

test('F: selecting a swipe that was made before a Re-read numbers its revs on, so the chat\'s revs stay strictly increasing', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 30\n</Changes>');
    const first = host.ctx.chat.length - 1;
    await host.send('On.', 'Noon.');
    const second = host.ctx.chat.length - 1;
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 1 }, { cause: 'ui' });
    await host.swipe('Noon again.');
    await host.bus.command('gt.hit', { actor: 'ac_00000001', amount: 5 }, { cause: 'ui' });
    await host.store.flush();
    await host.st.swipeTo(second, 0);
    setStory(host, first, 'Dawn.\n\n<Changes>\n! tick 30\n! tick 31\n! tick 32\n</Changes>');
    const done = await host.turn.reread(first);
    assert.equal(done.ok, true, done.message);
    await host.st.swipeTo(second, 1);                      // the swipe made before the Re-read
    const receipts = receiptRevsOf(host);
    assert.ok(inOrder(receipts), `receipt revs ${receipts}`);
    const stored = host.ctx.chat[second].extra.storySuite;
    assert.deepEqual(stored.receipts.map(receipt => receipt.rev), stored.ops.filter(op => op.path === '/meta/rev').map(op => op.value));
    assert.equal(host.head().meta.rev, receipts.at(-1));
    assert.equal(host.head().domains.gt.lost.ac_00000001, 5);
});
