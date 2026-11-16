// v2 state store (SPEC §2, §12): swipes, delete rollback, untold receipts, save batching & verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    action, apply, deleteSwipe, greeting, initial, newSwipe, reply, setup, showSwipe, user,
} from './helpers/store-chat.js';
import { fakeTimers, isDeepFrozen, settle, SHORT, story } from './store.helpers.js';


test('each swipe has its own changes; a new swipe does not inherit the copied ones', () => {
    const { ctx, store } = story(2);
    const last = ctx.chat.at(-1);
    assert.equal(store.head().domains.inventory.stacks.it_2.qty, 2);
    newSwipe(last);
    assert.equal(last.extra.storySuite.swipe, 0, 'SillyTavern copied the old swipe\'s record');
    assert.equal(store.head().domains.inventory.stacks.it_2, undefined, 'the copy is not this swipe\'s state');
    assert.deepEqual(store.head(), store.at(2));
    action(store, 'it_x', 7);
    assert.equal(store.head().domains.inventory.stacks.it_x.qty, 7);
    assert.equal(last.swipe_info[1].extra.storySuite.swipe, 1);
    assert.deepEqual(last.swipe_info[1].extra.storySuite.ops, last.extra.storySuite.ops);
    showSwipe(last, 0);
    assert.equal(store.head().domains.inventory.stacks.it_2.qty, 2);
    assert.equal(store.head().domains.inventory.stacks.it_x, undefined);
    showSwipe(last, 1);
    assert.equal(store.head().domains.inventory.stacks.it_x.qty, 7);
});

test('a swipe that moved down after an earlier swipe was deleted keeps its changes', () => {
    const { ctx, store } = story(1);
    const last = ctx.chat.at(-1);
    newSwipe(last);
    action(store, 'it_b', 2);
    newSwipe(last);
    action(store, 'it_c', 3);
    deleteSwipe(last, 1);
    assert.equal(last.swipe_id, 1);
    assert.equal(last.extra.storySuite.swipe, 2);
    assert.equal(store.head().domains.inventory.stacks.it_c.qty, 3);
    assert.equal(store.head().domains.inventory.stacks.it_b, undefined);
});

test('a shifted swipe is stamped again on rebuild, so a new swipe copied from it at its old index starts empty', () => {
    const { ctx, store } = story(1);
    const last = ctx.chat.at(-1);
    newSwipe(last);
    action(store, 'it_b', 2);                  // swipe 1 holds it_b, stamped 1
    showSwipe(last, 0);
    deleteSwipe(last, 0);                      // swipe 1 becomes swipe 0, still stamped 1
    assert.equal(last.swipe_id, 0);
    assert.equal(last.extra.storySuite.swipe, 1);
    store.rebuild();                           // MESSAGE_SWIPE_DELETED
    assert.equal(last.extra.storySuite.swipe, 0, 'stamped with the swipe it now is');
    assert.equal(last.swipe_info[0].extra.storySuite.swipe, 0, 'swipe_info kept in step');
    assert.equal(store.dirty(), true, 'the new stamp goes with the next save');
    assert.equal(store.head().domains.inventory.stacks.it_b.qty, 2);
    newSwipe(last);                            // SillyTavern copies the record into swipe 1
    assert.equal(store.head().domains.inventory.stacks.it_b, undefined, 'the new swipe 1 is not the old swipe 1');
    showSwipe(last, 0);
    assert.equal(store.head().domains.inventory.stacks.it_b.qty, 2, 'the moved swipe keeps its changes');
    store.rebuild();
    assert.equal(last.extra.storySuite.swipe, 0, 'a record already stamped right is left alone');
});

test('deleting the last reply takes back its ops and the actions taken after it', () => {
    const { ctx, store } = story(3);
    const atTwo = store.at(4);
    const r = action(store, 'it_after', 9);
    ctx.chat.push(user('next'));
    action(store, 'it_after', 10);
    assert.deepEqual(ctx.chat[6].extra.storySuite.receipts.at(-2).id, r.id);
    ctx.chat.splice(5, 2);
    assert.equal(store.headIndex(), 4);
    assert.deepEqual(store.head(), atTwo);
    assert.equal(store.head().domains.inventory.stacks.it_after, undefined);
    assert.equal(store.head().domains.inventory.stacks.it_3, undefined);
});

test('a rebuild after a swipe of the last reply replays only from the nearest checkpoint', () => {
    let calls = 0;
    const counting = (state, ops) => { calls++; return apply(state, ops); };
    const { ctx, store } = story(45, { ...SHORT, apply: counting });
    newSwipe(ctx.chat.at(-1));
    calls = 0;
    store.rebuild();
    // Checkpoints at carriers 0, 20, 40; the head is carrier 45: carriers 40..44 have ops, 45 is empty.
    assert.equal(calls, 5);
    calls = 0;
    store.head();
    store.head();
    assert.equal(calls, 0, 'the head is cached');
    action(store, 'it_new', 1);
    assert.equal(calls, 1, 'an append applies only its own ops');
});

test('untold receipts: told once a later carrier lists them; a swipe of the telling reply re-tells', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const a = action(store, 'it_a', 1);
    const quiet = action(store, 'it_b', 1, { narrate: false });
    const b = action(store, 'it_c', 1);
    assert.deepEqual(store.untold().map(r => r.id), [a.id, b.id], 'oldest first; narrate:false is left out');
    assert.ok(isDeepFrozen(store.untold()));
    assert.ok(!store.untold().some(r => r.id === quiet.id));
    ctx.chat.push(user(), reply('It is told.'));
    store.setNarrated(4, [a.id, b.id]);
    assert.deepEqual(store.untold(), []);
    assert.equal(ctx.chat[4].extra.storySuite.rev, 3);
    const c = action(store, 'it_d', 1);
    assert.deepEqual(store.untold().map(r => r.id), [c.id]);
    newSwipe(ctx.chat[4]);
    assert.deepEqual(store.untold().map(r => r.id), [a.id, b.id], 'the new swipe starts with nothing narrated');
    store.setNarrated(4, [a.id]);
    assert.deepEqual(store.untold().map(r => r.id), [b.id]);
    showSwipe(ctx.chat[4], 0);
    assert.deepEqual(store.untold().map(r => r.id), [c.id]);
    ctx.chat.splice(3, 2);
    assert.deepEqual(store.untold().map(r => r.id), [a.id, b.id], 'deleting the telling reply re-tells');
});

test('a cue committed on the carrier being re-generated is told by that same carrier', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const cue = action(store, 'it_cue', 1, { cause: 'system' });
    store.setNarrated(2, [cue.id]);
    assert.deepEqual(store.untold(), []);
    assert.throws(() => store.setNarrated(1, []), RangeError);
    assert.throws(() => store.setNarrated(2, [1]), TypeError);
});

test('save verification (SPEC §3.3): a record replaced while saving fails the save, keeps it dirty, and is told once', async () => {
    let tamper = null;
    const errors = [];
    const { ctx, store } = setup([greeting(), user(), reply()], { save: async () => { tamper?.(); } });
    store.ensureInitial(initial());
    action(store, 'it_1', 1);
    tamper = () => { ctx.chat[2].extra = { storySuite: { ...ctx.chat[2].extra.storySuite, rev: 99 } }; };
    await assert.rejects(store.flush(), /message 2 no longer holds its latest changes \(change 99 instead of 1\); the story stays marked unsaved/);
    assert.equal(store.dirty(), true, 'still marked unsaved');
    tamper = null;
    await store.flush();
    assert.equal(store.dirty(), false, 'the next save writes the chat as it is and is not refused again');
    // A scheduled save that fails the check goes to onSaveError.
    const timers = { setTimeout: fn => { timers.fn = fn; return 1; }, clearTimeout: () => {} };
    const second = setup([greeting(), user(), reply()], { save: async () => { tamper?.(); }, onSaveError: error => errors.push(error.message), timers });
    second.store.ensureInitial(initial());
    action(second.store, 'it_1', 1);
    tamper = () => { second.ctx.chat[2].extra.storySuite.rev = 5; };
    second.store.scheduleSave();
    timers.fn();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no longer holds its latest changes/);
    assert.equal(second.store.dirty(), true);
});

test('save verification: a change made during the save, or a message deleted, is no false alarm', async () => {
    let during = null;
    const { ctx, store } = setup([greeting(), user(), reply()], { save: async () => { await null; during?.(); } });
    store.ensureInitial(initial());
    action(store, 'it_1', 1);
    during = () => action(store, 'it_2', 2);
    await store.flush();
    assert.equal(store.dirty(), true, 'the change made during the save goes with the next one');
    during = null;
    await store.flush();
    assert.equal(store.dirty(), false);
    action(store, 'it_3', 3);
    during = () => { ctx.chat.splice(1); };
    await store.flush();
    assert.equal(store.dirty(), false, 'the written reply is gone: nothing of it to check');
});

test('saves are batched: one per burst, 400 ms after the last call', async () => {
    const timers = fakeTimers();
    const { ctx, store } = setup([greeting()], { timers });
    store.ensureInitial(initial());
    store.scheduleSave();
    timers.advance(300);
    store.scheduleSave();
    timers.advance(300);
    assert.equal(ctx.saves, 0);
    store.scheduleSave();
    timers.advance(399);
    assert.equal(ctx.saves, 0);
    timers.advance(1);
    await settle();
    assert.equal(ctx.saves, 1);
    assert.equal(store.dirty(), false);
    await store.flush();
    assert.equal(ctx.saves, 1, 'nothing to save');
});

test('flush saves a pending burst at once and waits for it', async () => {
    const timers = fakeTimers();
    let release;
    const { ctx, store } = setup([greeting()], {
        timers, save: () => new Promise(resolve => { release = () => { ctx.saves++; resolve(); }; }),
    });
    store.ensureInitial(initial());
    store.scheduleSave();
    let done = false;
    const flushing = store.flush().then(() => { done = true; });
    await settle();
    assert.equal(timers.count(), 1, 'the scheduled save is cancelled (what waits is the save\'s 20 s answer timeout)');
    assert.equal(done, false);
    action(store, 'it_during', 1);
    release();
    await flushing;
    assert.equal(ctx.saves, 1);
    assert.equal(store.dirty(), true, 'a change made during the save is still unsaved');
    const again = store.flush();
    await settle();
    release();
    await again;
    assert.equal(store.dirty(), false);
});

test('a failed save keeps the store dirty, rethrows from flush, and a later flush retries', async () => {
    const timers = fakeTimers();
    let fail = true;
    const errors = [];
    const { ctx, store } = setup([greeting()], {
        timers, onSaveError: error => errors.push(error.message),
        save: async () => { if (fail) throw new Error('disk full'); ctx.saves++; },
    });
    store.ensureInitial(initial());
    store.scheduleSave();
    timers.advance(400);
    await settle();
    assert.deepEqual(errors, ['disk full'], 'a scheduled save reports, it does not throw');
    assert.equal(store.dirty(), true);
    await assert.rejects(store.flush(), /disk full/);
    assert.equal(store.dirty(), true);
    fail = false;
    await store.flush();
    assert.equal(ctx.saves, 1);
    assert.equal(store.dirty(), false);
});
