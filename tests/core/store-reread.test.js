// v2 state store (SPEC §2, §12): Re-read replacement, healing, and skipped-block replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    action, fullReplay, greeting, initial, receipt, reply, setup, user,
} from '../../packages/story-block/tests/v2/helpers/store-chat.js';
import { SHORT, story } from './store.helpers.js';


test('Re-read replaces the story receipts and their ops and keeps the ui and system ones', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const story = receipt({ cause: 'story', rev: 1 });
    store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 1 }, { op: 'add', path: '/domains/scene/place', value: 'Lake' }], receipt: story });
    const ui = action(store, 'it_rope', 1);
    const cue = action(store, 'it_map', 1, { cause: 'system' });
    const reread = receipt({ cause: 'story', rev: 1 });
    store.replaceStory(2, { ops: [{ op: 'replace', path: '/domains/scene/place', value: 'Forest' }], receipts: [reread] });
    const record = ctx.chat[2].extra.storySuite;
    assert.deepEqual(record.receipts.map(r => r.id), [reread.id, ui.id, cue.id]);
    assert.equal(store.head().domains.scene.place, 'Forest');
    assert.equal(store.head().domains.inventory.stacks.it_rope.qty, 1);
    assert.equal(store.head().domains.inventory.stacks.it_map.qty, 1);
    assert.equal(store.head().meta.rev, 3);
    assert.deepEqual(store.head(), fullReplay(ctx.chat, 2));
    assert.deepEqual(record.spans, [{ n: 1, story: true }, { n: 2, story: false }, { n: 2, story: false }]);
    assert.deepEqual(ctx.chat[2].swipe_info[0].extra.storySuite, record);
});

test('Re-read of a reply with two preludes and a step, twice: each keeps its own block, the receipts and /meta/rev stay as live', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const at = (rev, extra = {}) => receipt({ cause: 'system', rev, afterCapture: true, ...extra });
    const run = rev => ({ ops: [{ op: 'replace', path: '/meta/rev', value: rev }], receipt: at(rev, rev < 3 ? { beforeGenerate: true } : {}) });
    for (const rev of [1, 2, 3]) store.append(run(rev));
    const live = structuredClone(ctx.chat[2].extra.storySuite);
    const liveHead = store.head();
    for (let pass = 0; pass < 2; pass += 1) {
        const steps = [1, 2].map(rev => at(rev, { beforeGenerate: true }));
        const settled = [{ ops: [{ op: 'replace', path: '/meta/rev', value: 3 }], receipt: at(3) }];
        store.replaceStory(2, {
            ops: [1, 2].map(rev => ({ op: 'replace', path: '/meta/rev', value: rev })), receipts: steps, settled,
            blocks: steps.map(receipt => ({ n: 1, receipt })),
        });
        const record = ctx.chat[2].extra.storySuite;
        assert.equal(record.receipts.length, live.receipts.length, `pass ${pass}: no receipt is kept beside its new copy`);
        assert.deepEqual(record.spans.map(span => span.n), live.spans.map(span => span.n), `pass ${pass}: one block per prelude and step, as live`);
        assert.equal(store.head().meta.rev, liveHead.meta.rev, `pass ${pass}: /meta/rev is as live`);
        assert.deepEqual(store.head(), fullReplay(ctx.chat, 2));
    }
});

test('Re-read heals a record an older Re-read stored with its two preludes merged: live spans and receipts, revs as a replay of the healed record', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    const at = (rev, extra = {}) => receipt({ cause: 'system', rev, afterCapture: true, ...extra });
    for (const rev of [1, 2, 3]) store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: rev }], receipt: at(rev, rev < 3 ? { beforeGenerate: true } : {}) });
    const live = structuredClone(ctx.chat[2].extra.storySuite);
    const liveHead = structuredClone(store.head());
    ctx.chat[2].extra.storySuite.spans.splice(0, 2, { n: 2, story: false });     // (the old merge: both preludes in one span)
    for (let pass = 0; pass < 2; pass += 1) {
        const steps = [1, 2].map(rev => at(rev, { beforeGenerate: true }));
        store.replaceStory(2, {
            ops: [1, 2].map(rev => ({ op: 'replace', path: '/meta/rev', value: rev })), receipts: steps,
            settled: [{ ops: [{ op: 'replace', path: '/meta/rev', value: 3 }], receipt: at(3) }],
            blocks: steps.map(receipt => ({ n: 1, receipt })),
        });
        const record = ctx.chat[2].extra.storySuite;
        assert.equal(record.receipts.length, live.receipts.length, `pass ${pass}: no old receipt stays beside its new copy`);
        assert.deepEqual(record.spans.map(span => span.n), live.spans.map(span => span.n), `pass ${pass}: one block per prelude and step`);
        assert.deepEqual(store.head(), liveHead, `pass ${pass}: the state and /meta/rev are as live`);
        assert.deepEqual(store.head(), fullReplay(ctx.chat, 2), `pass ${pass}: and as a clean rebuild`);
    }
});

// A reply with preludes P1, P2, a story line, one afterCapture step and a reader block (the shape the heal tests start from).
const rv = value => ({ op: 'replace', path: '/meta/rev', value });
const placeOp = place => ({ op: 'replace', path: '/domains/scene/place', value: place });
const stackOp = (id, qty) => ({ op: 'add', path: `/domains/inventory/stacks/${id}`, value: { id, qty } });
const prelude = rev => receipt({ cause: 'system', rev, afterCapture: true, beforeGenerate: true });
const stepAt = rev => receipt({ cause: 'system', rev, afterCapture: true });
function liveReply() {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    store.append({ ops: [rv(1), placeOp('P1')], receipt: prelude(1) });
    store.append({ ops: [rv(2), placeOp('P2')], receipt: prelude(2) });
    store.append({ ops: [rv(3), stackOp('it_a', 1)], receipt: receipt({ cause: 'story', rev: 3 }) });
    store.append({ ops: [rv(4), placeOp('Camp')], receipt: stepAt(4) });
    store.append({ ops: [rv(5), stackOp('it_ui', 2)], receipt: receipt({ cause: 'ui', rev: 5 }) });
    return { ctx, store };
}
function rereadLive(store) {
    const steps = [prelude(1), prelude(2)];
    const story = receipt({ cause: 'story', rev: 3 });
    store.replaceStory(2, {
        ops: [rv(1), placeOp('P1'), rv(2), placeOp('P2'), rv(3), stackOp('it_a', 1)], receipts: [...steps, story],
        settled: [{ ops: [rv(4), placeOp('Camp')], receipt: stepAt(4) }],
        blocks: [{ n: 2, receipt: steps[0] }, { n: 2, receipt: steps[1] }, { n: 2, receipt: story }],
    });
}

test('Re-read heals a record two older Re-reads left (merged preludes twice, old step renumbered): domains as live, stable, replay == head', () => {
    const { ctx, store } = liveReply();
    const liveHead = structuredClone(store.head());
    const rec = ctx.chat[2].extra.storySuite;
    const [p1, p2, , step, ui] = rec.receipts;
    rec.ops = [rv(1), placeOp('P1'), rv(2), placeOp('P2'), rv(3), stackOp('it_a', 1), rv(4), placeOp('P1'), rv(5), placeOp('P2'), rv(6), placeOp('Camp'), rv(7), stackOp('it_ui', 2)];
    rec.receipts = [prelude(1), prelude(2), receipt({ cause: 'story', rev: 3 }), { ...p1, rev: 4 }, { ...p2, rev: 5 }, { ...step, rev: 6 }, { ...ui, rev: 7 }];
    rec.spans = [{ n: 4, story: false }, { n: 2, story: true }, { n: 4, story: false }, { n: 2, story: false }, { n: 2, story: false }];
    rec.rev = 7;
    if (ctx.chat[2].swipe_info?.[0]?.extra) ctx.chat[2].swipe_info[0].extra.storySuite = structuredClone(rec);
    let first = null;
    for (let pass = 0; pass < 3; pass += 1) {
        rereadLive(store);
        const record = structuredClone(ctx.chat[2].extra.storySuite);
        assert.deepEqual(record.spans.map(span => [span.n, span.story]), [[2, false], [2, false], [2, true], [2, false], [2, false]], `pass ${pass}: one block per prelude, story, step, reader`);
        assert.deepEqual(record.receipts.map(each => each.cause), ['system', 'system', 'story', 'system', 'ui'], `pass ${pass}: receipts in live order`);
        assert.deepEqual(store.head().domains, liveHead.domains, `pass ${pass}: domains as live`);
        assert.deepEqual(store.head(), fullReplay(ctx.chat, 2), `pass ${pass}: replay == head`);
        if (first) {
            assert.deepEqual(record.ops, first.ops, `pass ${pass}: ops unchanged`);
            assert.deepEqual(record.spans, first.spans, `pass ${pass}: spans unchanged`);
        } else first = record;
    }
});

test('Re-read leaves an unpaired record the heal cannot pair as stored: its afterCapture step is kept', () => {
    const { ctx, store } = liveReply();
    const rec = ctx.chat[2].extra.storySuite;
    rec.receipts.push(receipt({ cause: 'ui', rev: 99 }));     // names no stored change; unguarded, so not quarantined
    if (ctx.chat[2].swipe_info?.[0]?.extra) ctx.chat[2].swipe_info[0].extra.storySuite = structuredClone(rec);
    assert.equal(fullReplay(ctx.chat, 2).domains.scene.place, 'Camp');
    rereadLive(store);
    assert.equal(store.head().domains.scene.place, 'Camp', 'the step\'s change is still in the head');
    assert.deepEqual(store.head(), fullReplay(ctx.chat, 2), 'replay == head');
});

test('Re-read without settled steps: a kept afterCapture step planned again keeps its afterCapture mark', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 1 }], receipt: receipt({ cause: 'story', rev: 1 }) });
    store.append({ ops: [{ op: 'replace', path: '/meta/rev', value: 2 }], receipt: receipt({ cause: 'system', rev: 2, afterCapture: true, replan: { payload: {} } }) });
    let asked = 0;
    const rerun = () => { asked += 1; return { ok: true, ops: [{ op: 'replace', path: '/meta/rev', value: 2 }], receipt: receipt({ cause: 'system', rev: 2, replan: { payload: {} } }) }; };
    store.replaceStory(2, { ops: [{ op: 'replace', path: '/meta/rev', value: 1 }], receipts: [receipt({ cause: 'story', rev: 1 })], rerun });
    assert.equal(asked, 1, 'the step was planned again');
    const step = ctx.chat[2].extra.storySuite.receipts.find(each => each.cause === 'system');
    assert.equal(step.afterCapture, true, 'its mark is kept');
});

test('Re-read rejects non-story receipts and changes that no longer fit, writing nothing', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    store.append({ ops: [{ op: 'add', path: '/domains/inventory/stacks/it_trout', value: { id: 'it_trout', qty: 1 } }],
        receipt: receipt({ cause: 'story' }) });
    store.append({ ops: [{ op: 'replace', path: '/domains/inventory/stacks/it_trout/qty', value: 0 }], receipt: receipt() });
    const snapshot = structuredClone(ctx.chat);
    const head = store.head();
    assert.throws(() => store.replaceStory(2, { ops: [], receipts: [receipt({ cause: 'ui' })] }), /story receipts and generated-reply preludes only/);
    assert.throws(() => store.replaceStory(2, { ops: [], receipts: [] }), /do not fit/);
    assert.throws(() => store.replaceStory(1, { ops: [], receipts: [] }), RangeError);
    assert.deepEqual(ctx.chat, snapshot);
    assert.equal(store.head(), head);
});

test('Re-read of an older reply refreshes later checkpoints so replay still equals a rebuild', () => {
    const { ctx, store } = story(25);
    const at = 2;
    const story1 = receipt({ cause: 'story' });
    store.replaceStory(at, { ops: [{ op: 'add', path: '/domains/scene/place', value: 'Reread' }], receipts: [story1] });
    // carrier 2's ui action (it_1) is kept after the new story op
    assert.equal(store.head().domains.scene.place, 'Reread');
    assert.equal(store.head().domains.inventory.stacks.it_1.qty, 1);
    assert.equal(ctx.chat[40].extra.storySuite.checkpoint.domains.scene.place, 'Reread');
    for (let i = 0; i < ctx.chat.length; i += 7) assert.deepEqual(store.at(i), fullReplay(ctx.chat, i));
    const { store: fresh } = setup(ctx.chat, SHORT);
    assert.deepEqual(fresh.head(), store.head());
});

test('Re-read of an older reply is refused when a later change depends on what it replaces', () => {
    const { ctx, store } = setup([greeting(), user(), reply()]);
    store.ensureInitial(initial());
    store.append({ ops: [{ op: 'add', path: '/domains/inventory/stacks/it_t', value: { id: 'it_t', qty: 1 } }],
        receipt: receipt({ cause: 'story' }) });
    ctx.chat.push(user(), reply());
    // A counted take (it carries `was`): replayed onto a stack that is not there, it still fails.
    store.append({ ops: [{ op: 'remove', path: '/domains/inventory/stacks/it_t', was: 1, count: '/qty' }], receipt: receipt() });
    const snapshot = structuredClone(ctx.chat);
    assert.throws(() => store.replaceStory(2, { ops: [], receipts: [] }), /later change \(message 4\)/);
    assert.deepEqual(ctx.chat, snapshot);
});

test('ops stored on a carrier that no longer apply are skipped and reported, not thrown', () => {
    const { ctx, store } = story(3);
    ctx.chat[4].extra.storySuite.ops.push({ op: 'replace', path: '/domains/missing', value: 1 });
    store.rebuild();
    assert.equal(store.problems().length, 1);
    assert.equal(store.problems()[0].index, 4);
    assert.equal(store.head().domains.inventory.stacks.it_2, undefined, 'the whole carrier is skipped');
    assert.equal(store.head().domains.inventory.stacks.it_3.qty, 3);
});

test('replay skips only the block that no longer applies; the carrier\'s other receipts and later commits stay', () => {
    const { ctx, store } = story(2);
    const kept = action(store, 'it_x', 7);          // a second block on the head carrier (4)
    const record = ctx.chat[4].extra.storySuite;
    assert.deepEqual(record.spans.map(span => span.n), [2, 2]);
    const broken = record.receipts[0];
    record.ops[1] = { op: 'replace', path: '/domains/missing', value: 1 };   // the first block now fails
    store.rebuild();
    assert.deepEqual(store.problems().map(problem => [problem.index, problem.block, problem.receipts]), [[4, 0, [broken.id]]]);
    assert.equal(store.head().domains.inventory.stacks.it_2, undefined, 'the broken block is skipped');
    assert.deepEqual(store.head().domains.inventory.stacks.it_x, { id: 'it_x', qty: 7 }, 'the block after it applies');
    assert.equal(store.head().meta.rev, kept.rev, 'the skipped block\'s rev still counts');
    const later = action(store, 'it_y', 1);
    assert.equal(later.rev, kept.rev + 1, 'a new receipt gets a rev of its own');
    store.rebuild();
    assert.equal(store.head().domains.inventory.stacks.it_y.qty, 1, 'a commit onto the carrier survives the rebuild');
    assert.equal(store.problems().length, 1);
    const { store: fresh } = setup(structuredClone(ctx.chat));
    assert.deepEqual(fresh.head(), store.head(), 'a new store agrees');
});

test('Re-read of an older reply keeps a later block that was already skipped skipped, and is not refused for it', () => {
    const { ctx, store } = setup([greeting(), user(), reply(), user(), reply()]);
    store.ensureInitial(initial());
    ctx.chat.splice(3);
    store.append({ ops: [{ op: 'add', path: '/domains/scene/place', value: 'Old' }], receipt: receipt({ cause: 'story' }) });
    ctx.chat.push(user(), reply());
    action(store, 'it_a', 1);
    action(store, 'it_b', 2);
    ctx.chat[4].extra.storySuite.ops[1] = { op: 'replace', path: '/domains/missing', value: 1 };
    store.rebuild();
    assert.equal(store.problems().length, 1);
    store.replaceStory(2, { ops: [{ op: 'replace', path: '/domains/scene/place', value: 'New' }], receipts: [receipt({ cause: 'story' })] });
    assert.equal(store.head().domains.scene.place, 'New');
    assert.equal(store.head().domains.inventory.stacks.it_b.qty, 2);
    assert.equal(store.head().domains.inventory.stacks.it_a, undefined, 'still skipped');
    assert.deepEqual(store.problems().map(problem => [problem.index, problem.block]), [[4, 0]], 'and still reported');
});
