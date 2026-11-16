// v2 state store (SPEC §2, §12): initial state, actions, checkpoints, replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    action, fullReplay, greeting, initial, receipt, reply, setup, user,
    withoutStory,
} from '../../packages/story-block/tests/v2/helpers/store-chat.js';
import { afterOps, isDeepFrozen, SHORT, story } from './store.helpers.js';


test('a greeting-only chat gets the initial state as its checkpoint; states are deep-frozen', () => {
    const { ctx, store } = setup();
    assert.equal(store.head(), null);
    assert.equal(store.headIndex(), 0);
    store.ensureInitial(initial());
    assert.deepEqual(store.head(), initial());
    assert.ok(isDeepFrozen(store.head()));
    assert.throws(() => { store.head().meta.rev = 9; }, TypeError);
    assert.deepEqual(store.at(0), initial());
    const record = ctx.chat[0].extra.storySuite;
    assert.equal(record.v, 2);
    assert.deepEqual(record.checkpoint, initial());
    assert.deepEqual([record.ops, record.receipts, record.narrated], [[], [], []]);
    assert.deepEqual(ctx.chat[0].swipe_info[0].extra.storySuite, record, 'swipe_info kept in step');
    assert.notEqual(ctx.chat[0].swipe_info[0].extra.storySuite, record, 'a copy, not the same object');
    assert.equal(store.dirty(), true);
    store.ensureInitial({ v: 2, meta: { rev: 5, claims: {} }, domains: {} });
    assert.deepEqual(store.head(), initial(), 'a chat that has state keeps it');
});

test('an empty chat, or one that starts with the user, has no state until a carrier exists', () => {
    const { ctx, store } = setup([]);
    assert.equal(store.headIndex(), -1);
    store.ensureInitial(initial());
    assert.equal(store.head(), null);
    assert.equal(store.dirty(), false);
    ctx.chat.push(user());
    store.ensureInitial(initial());
    assert.equal(store.head(), null);
    assert.throws(() => store.append({ ops: [], receipt: receipt() }), /no reply/);
    ctx.chat.push(reply());
    store.ensureInitial(initial());
    assert.equal(store.headIndex(), 1);
    assert.deepEqual(store.head(), initial());
    assert.equal(store.at(0), null, 'nothing before the first carrier');
    assert.throws(() => store.at(2), RangeError);
    assert.deepEqual(store.at(1), initial());
});

test('a chat with v1 extras is kept as it is: read-only on an empty story until the reader starts it over', () => {
    const v1 = {
        storyBlockIdentity: { id: 'old', swipe: 0 }, storyDirectorQuest: { receipts: [{ id: 'payment' }] },
        rpgBattleEvidence: { events: [] }, storySuite: { v: 1, state: { gold: 99 } },
    };
    const chat = [greeting(), user(), reply()];
    chat[0].extra = structuredClone(v1);
    chat[2].extra = structuredClone(v1);
    const { ctx, store } = setup(chat);
    assert.equal(store.head(), null);
    assert.deepEqual(store.untold(), []);
    const notes = store.ensureInitial(initial());
    assert.equal(notes.length, 1);
    assert.match(notes[0], /older version of Story Suite/);
    assert.deepEqual(store.head(), initial(), 'an empty working state');
    assert.equal(store.readOnly().kind, 'legacy');
    assert.deepEqual(ctx.chat[0].extra, v1, 'the v1 record is not replaced (this test used to expect it replaced)');
    assert.deepEqual(ctx.chat[2].extra, v1, 'later carriers are not touched');
    assert.throws(() => store.append({ ops: [], receipt: { id: 'rc_00000001', type: 't', module: 'm', cause: 'ui', seed: 1, summary: '', narrate: false, data: {}, rev: 1 } }), /read-only/);
    // The reader starts it over: the v1 record is set aside, not lost, and the story has a v2 record.
    store.startOver({ confirmed: true });
    assert.equal(store.readOnly(), null);
    assert.deepEqual(store.head(), initial());
    assert.deepEqual(ctx.chat[0].extra.storySuiteAside, [{ kind: 'legacy', record: v1.storySuite }]);
    assert.deepEqual(ctx.chat[0].extra.storySuite.checkpoint, initial());
    assert.equal(ctx.chat[0].extra.storyBlockIdentity.id, 'old', 'v1 extras of other extensions are left alone');
    assert.deepEqual(ctx.chat[2].extra.storySuiteAside, [{ kind: 'legacy', record: v1.storySuite }], 'and so is the v1 record of a later reply, set aside');
});

test('actions go onto the head carrier, even while the user message after it waits for a reply', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const before = withoutStory(ctx.chat);
    const first = action(store, 'it_a', 2);
    assert.equal(store.head().domains.inventory.stacks.it_a.qty, 2);
    assert.equal(store.head().meta.rev, 1);
    ctx.chat.push(user('I drink it.'));
    assert.equal(store.headIndex(), 2);
    const second = action(store, 'it_a', 1);
    const record = ctx.chat[2].extra.storySuite;
    assert.deepEqual(record.receipts.map(r => r.id), [first.id, second.id]);
    assert.equal(record.ops.length, 4);
    assert.equal(record.rev, 2);
    assert.deepEqual(record.spans, [{ n: 2, story: false }, { n: 2, story: false }]);
    assert.deepEqual(ctx.chat[2].swipe_info[0].extra.storySuite, record);
    assert.equal(ctx.chat[3].extra.storySuite, undefined, 'user messages hold nothing');
    ctx.chat.pop();
    assert.deepEqual(withoutStory(ctx.chat), before, 'nothing in the chat but extra.storySuite changed');
    assert.ok(isDeepFrozen(store.head()));
});

test('a bad op or a duplicate receipt rejects the append and writes nothing', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const r = action(store, 'it_a', 1);
    const snapshot = structuredClone(ctx.chat);
    const head = store.head();
    assert.throws(() => store.append({ ops: [{ op: 'replace', path: '/domains/nowhere/x', value: 1 }], receipt: receipt() }));
    assert.throws(() => store.append({ ops: [], receipt: r }), /already stored/);
    assert.throws(() => store.append({ ops: 'nope' }), TypeError);
    assert.deepEqual(ctx.chat, snapshot);
    assert.equal(store.head(), head);
    store.append({ ops: [] });
    assert.deepEqual(ctx.chat, snapshot, 'nothing to append is a no-op');
});

test('replay equals a full rebuild at every message, across many checkpoints', () => {
    const { ctx, store } = story(65);
    const checkpoints = ctx.chat.map((m, i) => (m.extra.storySuite?.checkpoint ? i : -1)).filter(i => i >= 0);
    assert.deepEqual(checkpoints, [0, 40, 80, 120], 'one every 20 carriers');
    for (let i = 0; i < ctx.chat.length; i++) assert.deepEqual(store.at(i), fullReplay(ctx.chat, i), `message ${i}`);
    const { store: fresh } = setup(ctx.chat, SHORT);
    assert.deepEqual(fresh.head(), store.head(), 'a new store on the same chat rebuilds the same head');
    assert.deepEqual(fresh.head(), fullReplay(ctx.chat, ctx.chat.length - 1));
    assert.equal(fresh.head().meta.rev, 65);
});

test('the checkpoint is the state before the carrier\'s own ops, on the 20th carrier, not the 19th', () => {
    const { ctx, store } = story(19);
    assert.equal(ctx.chat.filter(m => m.extra.storySuite?.checkpoint).length, 1);
    const before = store.head();
    ctx.chat.push(user(), reply());
    action(store, 'it_20', 20);
    const record = ctx.chat.at(-1).extra.storySuite;
    assert.deepEqual(record.checkpoint, before);
    assert.equal(record.checkpoint.domains.inventory.stacks.it_20, undefined);
    assert.equal(store.head().domains.inventory.stacks.it_20.qty, 20);
});

test('carriers with no changes still count toward the next checkpoint', () => {
    const { ctx, store } = story(1);
    for (let i = 0; i < 25; i++) ctx.chat.push(user(), reply());
    action(store, 'it_late', 1);
    assert.ok(ctx.chat.at(-1).extra.storySuite.checkpoint, 'first record past the threshold');
    assert.equal(store.head().domains.inventory.stacks.it_1.qty, 1);
});

test('a checkpoint is due once the ops since the last one exceed 32 KB of JSON, 10 carriers on at least', () => {
    assert.equal(afterOps(32 * 1024, 9, SHORT).record.checkpoint, undefined, 'exactly 32 KB is not over');
    const { record, ctx, store } = afterOps(32 * 1024 + 1, 9, SHORT);
    assert.ok(record.checkpoint, 'one byte more is');
    assert.equal(record.checkpoint.meta.rev, 0);
    assert.deepEqual(store.head(), fullReplay(ctx.chat, ctx.chat.length - 1));
    assert.equal(afterOps(32 * 1024 + 1, 8, SHORT).record.checkpoint, undefined, 'not before the 10th carrier');
});

test('one domain rewriting a large list on every reply does not bring a checkpoint every few replies', () => {
    // Each reply replaces a 40 KB list whole: the 128 KB rule alone would checkpoint every 4 replies.
    const { ctx, store } = setup([greeting()]);
    store.ensureInitial(initial());
    for (let i = 1; i <= 60; i++) {
        ctx.chat.push(user(), reply());
        store.append({ ops: [{ op: 'add', path: '/domains/scene/log', value: Array.from({ length: 400 }, (_, n) => `entry ${i}.${n} `.padEnd(95, '.')) },
            { op: 'replace', path: '/meta/rev', value: i }] });
    }
    const placed = ctx.chat.map((m, i) => (m.extra?.storySuite?.checkpoint ? i : -1)).filter(i => i >= 0);
    const gaps = placed.slice(1).map((at, n) => (at - placed[n]) / 2);
    assert.ok(gaps.length >= 2 && gaps.every(gap => gap >= 10), `checkpoints ${JSON.stringify(placed)}`);
    assert.deepEqual(store.head(), fullReplay(ctx.chat, ctx.chat.length - 1));
});

test('with a large state the bytes rule waits for twice the checkpoint\'s own size of ops', () => {
    const large = () => {
        const state = initial();
        state.domains.scene.lore = 'y'.repeat(150 * 1024);   // a 150 KB state
        return state;
    };
    const run = bytes => {
        const big = n => [{ op: 'add', path: '/domains/scene/note', value: 'x'.repeat(n) }];
        const { ctx, store } = setup([greeting()]);
        store.ensureInitial(large());
        store.append({ ops: big(bytes - JSON.stringify(big(0)).length) });
        for (let i = 0; i < 10; i++) ctx.chat.push(user(), reply());
        store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 1 }] });
        return ctx.chat.at(-1).extra.storySuite.checkpoint;
    };
    assert.equal(run(200 * 1024), undefined, '200 KB of ops: over 128 KB, under twice 150 KB');
    assert.ok(run(310 * 1024), 'over twice the checkpoint');
});

test('by default a checkpoint comes every 100 carriers, or once the ops since the last exceed 128 KB', () => {
    const { ctx, store } = story(205, {});
    const checkpoints = ctx.chat.map((m, i) => (m.extra.storySuite?.checkpoint ? i : -1)).filter(i => i >= 0);
    assert.deepEqual(checkpoints, [0, 200, 400], 'carriers 0, 100 and 200');
    for (let i = 0; i < ctx.chat.length; i += 13) assert.deepEqual(store.at(i), fullReplay(ctx.chat, i), `message ${i}`);
    assert.equal(afterOps(128 * 1024, 9, {}).record.checkpoint, undefined, 'exactly 128 KB is not over');
    assert.ok(afterOps(128 * 1024 + 1, 9, {}).record.checkpoint, 'one byte more is');
});

test('a state handed out is never the object stored in the chat', () => {
    const { ctx, store } = story(1);
    assert.notEqual(store.at(0), ctx.chat[0].extra.storySuite.checkpoint);
    assert.equal(Object.isFrozen(ctx.chat[0].extra.storySuite.checkpoint), false);
    assert.equal(Object.isFrozen(ctx.chat[2].extra.storySuite.ops[1].value), false);
});

test('a chat switched in place (same array) is noticed without an explicit rebuild', () => {
    const { ctx, store } = story(2);
    const other = story(5).ctx.chat;
    ctx.chat.splice(0, ctx.chat.length, ...other.slice(0, 5));
    assert.deepEqual(store.head(), fullReplay(other, 4));
});

test('the default apply comes from ops.js', async () => {
    const { createStore } = await import('../../packages/story-block/tests/v2/helpers/store-chat.js');
    const chat = [greeting()];
    const store = createStore({ chat: () => chat, save: async () => {} });
    store.ensureInitial(initial());
    store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 1 }], receipt: receipt() });
    assert.equal(store.head().meta.rev, 1);
});
