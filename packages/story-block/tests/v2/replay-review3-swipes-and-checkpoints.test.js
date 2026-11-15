// The third review of the replay core (docs/v2/REPLAY.md): one head per swipe on delete,
// checkpoint prefix/window trust, and carried Problems across checkpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { Q1, guarded, harness } from './helpers/guarded.js';
import { newSwipe, showSwipe } from './helpers/store-chat.js';
import { SMALL3, clone, cpOf, fullReplay, stDeleteSwipe } from './replay-review3.helpers.js';

test('E: deleting the shown swipe publishes one head, already reconciled, not one for the half-way state', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 90\n</Changes>');
    const first = host.ctx.chat.length - 1;
    await host.swipe('Dawn again.\n\n<Changes>\n! tick 0\n</Changes>');
    await host.store.flush();
    await host.st.swipeTo(first, 0);
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
    assert.equal(host.head().domains.gt.credits[Q1], 1);
    const seen = [];
    host.sdk.on('head', () => seen.push(host.head().domains.gt.credits[Q1]));
    await stDeleteSwipe(host, first, 0);        // the clock reply's swipe 0 (90) goes; swipe 1 (0) is shown
    assert.deepEqual(seen, [0], 'one head, with the attempt planned again on the clock that is shown now');
    assert.equal(host.head().domains.gt.minutes, 0);
    assert.deepEqual(host.store.problems().filter(problem => problem.code !== 'REPLANNED'), []);
});

test('E: deleting a swipe that is not shown is one change and one head, as ever', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 90\n</Changes>');
    const first = host.ctx.chat.length - 1;
    await host.swipe('Dawn again.\n\n<Changes>\n! tick 0\n</Changes>');
    await host.swipe('Dawn thrice.\n\n<Changes>\n! tick 20\n</Changes>');
    await host.store.flush();
    await host.st.swipeTo(first, 0);
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
    const seen = [];
    host.sdk.on('head', () => seen.push(host.head().domains.gt.credits[Q1]));
    await stDeleteSwipe(host, first, 2);
    assert.deepEqual(seen, [1], 'one head; the shown clock (90) is the same');
    assert.equal(host.ctx.chat[first].swipes.length, 2);
});

test('E: the deleted shown swipe is told by its record, not its text: identical text still gives one reconciled head', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.');
    const first = host.ctx.chat.length - 1;
    await host.bus.command('gt.tick', { minutes: 90 }, { cause: 'ui' });
    await host.swipe('Dawn.');                                   // the same text, its own record
    await host.bus.command('gt.tick', { minutes: 0 }, { cause: 'ui' });
    await host.store.flush();
    await host.st.swipeTo(first, 0);
    await host.send('On.', 'Noon.');
    await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
    assert.equal(host.head().domains.gt.credits[Q1], 1);
    const message = host.ctx.chat[first];
    assert.equal(message.swipes[0], message.swipes[1], 'the two swipes read the same');
    const seen = [];
    host.sdk.on('head', () => seen.push(host.head().domains.gt.credits[Q1]));
    await stDeleteSwipe(host, first, 0);
    assert.deepEqual(seen, [0], 'one head, with the attempt planned again on the clock that is shown now');
    assert.equal(host.head().domains.gt.minutes, 0);
});

test('E: deleting the shown swipe of the last reply never writes over the swipe that takes its place', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 90\n</Changes>');
    const at = host.ctx.chat.length - 1;
    await host.swipe('Dawn, once more.\n\n<Changes>\n! tick 0\n</Changes>');
    await host.store.flush();
    const message = host.ctx.chat[at];
    assert.equal(message.swipe_id, 1);
    const own = clone(message.swipe_info[0].extra.storySuite);
    assert.equal(host.head().domains.gt.minutes, 0);
    const seen = [];
    host.sdk.on('head', () => seen.push(host.head().domains.gt.minutes));
    await stDeleteSwipe(host, at, 1);                            // the shown one goes; swipe 0 is shown
    assert.deepEqual(seen, [90], 'one head, the clock of the swipe that is shown');
    assert.equal(host.head().domains.gt.minutes, 90);
    assert.deepEqual(message.swipe_info[0].extra.storySuite.ops, own.ops, 'swipe 0\'s own record was not written over');
    assert.equal(message.swipe_info[0].extra.storySuite.sid, own.sid);
    await host.st.loadChat(clone(host.ctx.chat));
    assert.equal(host.head().domains.gt.minutes, 90, 'and it stays so for good');
});

test('E: a swipe that is not shown, and a message with no swipe left, are one change each and never throw', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', 'Dawn.\n\n<Changes>\n! tick 90\n</Changes>');
    const at = host.ctx.chat.length - 1;
    await host.swipe('Dawn, once more.\n\n<Changes>\n! tick 0\n</Changes>');
    await host.store.flush();
    await host.st.swipeTo(at, 1);
    const seen = [];
    host.sdk.on('head', () => seen.push(host.head().domains.gt.minutes));
    await stDeleteSwipe(host, at, 0);                            // not the shown one
    assert.deepEqual(seen, [0], 'one head, nothing held back');
    // The only swipe is gone (SillyTavern does not allow it; whatever is sent must not throw).
    const message = host.ctx.chat[at];
    message.swipes.splice(0, 1);
    message.swipe_info.splice(0, 1);
    message.swipe_id = -1;
    await host.st.eventSource.emit('message_swipe_deleted', { messageId: at, swipeId: 0, newSwipeId: -1 });
    assert.doesNotThrow(() => host.head());
});

test('a checkpoint a Re-read rewrites is given the window it has now, so a later delete cannot make it trusted over a record it includes', () => {
    const SMALL = { checkpointEvery: 3, checkpointBytes: 1 << 30 };
    const h = harness([guarded()], SMALL);
    const at = [];
    for (let n = 1; n <= 8; n++) {
        at.push(h.send(`u${n}`, `r${n}`));
        h.command('gt.hit', { actor: 'ac_00000001', amount: n });
    }
    const cps = at.filter(i => h.chat[i].extra.storySuite.checkpoint);
    const cp = cps.at(-1);
    const record = h.chat[cp].extra.storySuite;
    const inside = at.filter(i => i > cps.at(-2) && i < cp)[0];
    // The window as an older write made it: without the record at `inside`.
    record.covers = record.covers.filter(sid => sid !== h.chat[inside].extra.storySuite.sid);
    h.store.rebuild();
    h.store.replaceStory(at[0], { ops: [], receipts: [] });
    const now = h.chat[cp].extra.storySuite;
    assert.ok(now.covers.includes(h.chat[inside].extra.storySuite.sid), 'the window names the record that is in it');
    // The reply inside it is deleted: a state that includes it must not be trusted.
    h.chat.splice(inside - 1, 2);
    h.store.rebuild();
    const live = JSON.stringify(h.store.head());
    const fresh = harness([guarded()], { checkpointEvery: 100000, checkpointBytes: 1 << 30 });
    const copy = clone(h.chat);
    copy.forEach((message, i) => { if (i && message.extra?.storySuite) { delete message.extra.storySuite.checkpoint; delete message.extra.storySuite.covers; delete message.extra.storySuite.coverHash; } });
    fresh.chat.splice(0, fresh.chat.length, ...copy);
    fresh.store.rebuild();
    assert.equal(live, JSON.stringify(fresh.store.head()));
});

// ---- round 5: a checkpoint is trusted only over the exact prefix it was made over -----------------------------

test('G: a checkpoint of an older chat (none of the new fields) is replayed from, not trusted; one rewritten by a Re-read is trusted only over the prefix it has', () => {
    const h = harness([guarded()], SMALL3);
    const at = [];
    for (let n = 1; n <= 8; n++) {
        at.push(h.send(`u${n}`, `r${n}`));
        h.command('gt.hit', { actor: 'ac_00000001', amount: n });
    }
    assert.equal(h.gt().lost.ac_00000001, 36);
    // An older chat: its checkpoints carry no window and no prefix.
    for (const i of cpOf(h).slice(1)) { delete h.chat[i].extra.storySuite.covers; delete h.chat[i].extra.storySuite.prefix; delete h.chat[i].extra.storySuite.coverHash; }
    h.store.rebuild();
    assert.equal(h.gt().lost.ac_00000001, 36, 'replayed from the start');
    // A Re-read rewrites them (and so gives each the prefix it is over now) ...
    h.store.replaceStory(at[0], { ops: [], receipts: [] });
    assert.ok(cpOf(h).slice(1).every(i => typeof h.chat[i].extra.storySuite.prefix === 'string'));
    // ... and a reply deleted from before one of them fails it: the full replay is what counts.
    h.chat.splice(at[3] - 1, 2);
    h.store.rebuild();
    assert.equal(h.gt().lost.ac_00000001, 32);
    assert.equal(JSON.stringify(h.store.head()), JSON.stringify(fullReplay(h).store.head()));
});

test('G: the checkpoint of a swipe that is not shown is not trusted once a Re-read changed what is in front of it', () => {
    const h = harness([guarded()], SMALL3);
    const at = [];
    for (let n = 1; n <= 6; n++) {
        at.push(h.send(`u${n}`, `r${n}`));
        if (n === 1) assert.equal(h.bus.command('gt.quick', { id: Q1 }, { cause: 'story' }).ok, true);
        else h.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
    }
    const last = at.at(-1);
    newSwipe(h.chat[last], 'r6 again');
    h.command('gt.hit', { actor: 'ac_00000001', amount: 10 });
    assert.ok(h.chat[last].extra.storySuite.checkpoint, 'the second swipe carries a checkpoint of its own');
    assert.equal(h.gt().coin, 1);
    showSwipe(h.chat[last], 0);
    h.store.rebuild();
    // The Re-read of the first reply no longer reads the quick line: its coin and claim go.
    h.store.replaceStory(at[0], { ops: [], receipts: [] });
    assert.equal(h.gt().coin, 0);
    showSwipe(h.chat[last], 1);
    h.store.rebuild();
    assert.equal(h.gt().coin, 0, 'the hidden swipe\'s own checkpoint does not bring the coin back');
    assert.equal(Object.keys(h.store.head().meta.claims).length, 0);
    assert.equal(h.gt().lost.ac_00000001, 14);
    assert.equal(JSON.stringify(h.store.head()), JSON.stringify(fullReplay(h).store.head()));
});

test('P: a block that is off before a checkpoint is still reported after a reload that starts from the checkpoint', () => {
    const h = harness([guarded()], SMALL3);
    h.send('u1', 'r1');
    assert.equal(h.command('gt.quick', { id: Q1 }).ok, true);
    h.send('u2', 'r2');
    h.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
    // Opened where its owner is not there: the quick is off, with a Problem.
    const g = guarded();
    const absent = [{ ...g, hooks: {} }];
    let fresh = 0x2000;
    const open = chat => {
        const other = harness(absent, { ...SMALL3, recordId: () => `sw_${(++fresh).toString(16).padStart(12, '0')}` });
        other.chat.splice(0, other.chat.length, ...clone(chat));
        other.store.rebuild();
        return other;
    };
    const a = open(h.chat);
    assert.equal(a.gt().coin, 0);
    const key = list => list.map(problem => [problem.index, problem.block, problem.code]);
    const first = key(a.problems());
    assert.ok(first.some(entry => entry[2] === 'REPLAY_PREREQUISITE'));
    // The chat goes on until a reply carries a checkpoint of its own.
    for (let n = 3; n <= 7; n++) {
        a.send(`u${n}`, `r${n}`);
        a.command('gt.hit', { actor: 'ac_00000001', amount: 1 });
    }
    const newest = a.chat.findLastIndex(message => message.extra?.storySuite?.checkpoint);
    assert.ok(newest > 3, 'a checkpoint on a later reply');
    assert.ok(a.record(newest).carried?.length, 'it carries the Problem of the block that is off');
    const live = key(a.problems());
    // A reload reads from that checkpoint, and reports the same as a full replay does.
    const reloaded = open(a.chat);
    const full = open(clone(a.chat).map((message, i) => {
        if (i && message.extra?.storySuite) { delete message.extra.storySuite.checkpoint; delete message.extra.storySuite.prefix; delete message.extra.storySuite.covers; delete message.extra.storySuite.carried; }
        return message;
    }));
    assert.deepEqual(key(reloaded.problems()), key(full.problems()));
    assert.deepEqual(key(reloaded.problems()), live);
    assert.ok(key(reloaded.problems()).length >= 1);
    assert.match(reloaded.problems()[0].message, /no longer apply/);
});
