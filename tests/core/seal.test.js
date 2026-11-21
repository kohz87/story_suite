// Sealed history, the seal (store/write/seal.js): what is sealed and when, the base it writes, the check that the chat reads the same from the
// base (or nothing is written), and a reload. Small window (4 replies, step 2) and checkpoints every 3 replies so checkpoints fall in the window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sealCount } from '../../core/store/write/seal.js';
import { grow, readout, reload, sealedIndexes, sealedSetup } from './seal.helpers.js';

test('the count sealed: a multiple of the step, always leaving the window (W..W+S-1 replies whole)', () => {
    const s = { window: 50, step: 25 };
    assert.deepEqual([49, 50, 74, 75, 99, 100, 200].map(n => sealCount(n, s)), [0, 0, 0, 25, 25, 50, 150]);
    for (let n = 0; n < 300; n++) {
        const whole = n - sealCount(n, s);
        assert.ok(n <= 50 ? whole === n : whole >= 50 && whole <= 74, `${n}`);
    }
});

test('a seal keeps the story exactly: head, Problems, receipts and proof read the same, and again after a reload', () => {
    const { ctx, store } = sealedSetup({ meta: { integrity: 'f1' } });
    grow(ctx, store, 9);
    const before = readout(store);
    const size = JSON.stringify(ctx.chat).length;
    const out = store.seal();
    assert.deepEqual(out, { ok: true, sealed: 6, through: ctx.chat[10].extra.storySuite.sid, from: 12 });
    assert.deepEqual(sealedIndexes(ctx.chat), [0, 2, 4, 6, 8, 10]);
    assert.equal(readout(store), before);
    assert.ok(JSON.stringify(ctx.chat).length < size, 'the chat file is smaller');
    const base = ctx.meta.storySuite.base;
    assert.deepEqual([base.v, base.count, base.window, base.step, base.integrity], [1, 6, 4, 2, 'f1']);
    assert.deepEqual(JSON.parse(JSON.stringify(store.at(10))), base.state, 'the state after the last sealed reply is the base');
    assert.equal(store.at(8), null, 'an earlier sealed reply has no state of its own any more');
    assert.deepEqual(store.history(), { status: 'ok', sealed: 6, from: 12, window: 4, step: 2 });
    assert.equal(store.dirty(), true, 'the seal is saved with the next save');
    const again = reload(ctx);
    assert.equal(readout(again.store), before);
    assert.equal(again.store.seal().sealed, 0, 'nothing more is due');
});

test('nothing is sealed before the window plus a step is full, and only in steps', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 4);
    assert.deepEqual(store.seal(), { ok: true, sealed: 0 }, 'five carriers: four whole, one not yet a step past');
    grow(ctx, store, 1, 4);
    assert.equal(store.seal().sealed, 2, 'six carriers: the first step');
    grow(ctx, store, 1, 6);
    assert.equal(store.seal().sealed, 0, 'seven: nothing new');
    grow(ctx, store, 1, 7);
    const before = readout(store);
    assert.equal(store.seal().sealed, 4, 'eight: the next step (four sealed in all)');
    assert.equal(readout(store), before);
});

test('checkpoints left in the window keep being trusted: their covers start at the base, and a later reply builds on them', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 9);
    store.seal();
    const kept = ctx.chat.map((m, i) => (m.extra?.storySuite?.checkpoint ? i : -1)).filter(i => i >= 0);
    assert.ok(kept.length >= 1 && kept.every(i => i >= 12), `checkpoints only in the window: ${kept}`);
    for (const i of kept) assert.ok(!ctx.chat[i].extra.storySuite.covers?.some(sid => ctx.chat.some(m => m.extra?.storySuite?.sealed === 1 && m.extra.storySuite.sid === sid)), 'no covers name a sealed reply');
    const before = store.work().recordsRead;
    store.rebuild();
    assert.ok(store.work().recordsRead - before <= 4, 'a rebuild replays from the last checkpoint, not from the base');
    grow(ctx, store, 6, 9);
    const head = readout(store);
    assert.equal(readout(reload(ctx).store), head);
});

test('a seal whose rebuilt story would differ writes nothing: the chat and its metadata stay byte for byte, and it is not tried again', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 9);
    // A checkpoint in the window whose state was changed by hand: the chain still trusts it (its prefix and covers hold), so the head reads
    // through it today. A seal drops it (it does not hold the state in front of it), so the chat rebuilt from the base would read otherwise.
    const at = ctx.chat.findIndex((m, i) => i > 12 && m.extra?.storySuite?.checkpoint);
    const record = ctx.chat[at].extra.storySuite;
    ctx.chat[at].extra.storySuite = { ...record, checkpoint: { ...record.checkpoint, domains: { ...record.checkpoint.domains, scene: { place: 'Nowhere' } } } };
    store.rebuild();
    const chat = JSON.stringify(ctx.chat);
    const meta = JSON.stringify(ctx.meta);
    const head = readout(store);
    assert.equal(store.head().domains.scene.place, 'Nowhere', 'the head reads through the changed checkpoint');
    const out = store.seal();
    assert.equal(out.ok, false);
    assert.equal(out.refused, true);
    assert.equal(JSON.stringify(ctx.chat), chat);
    assert.equal(JSON.stringify(ctx.meta), meta);
    assert.equal(readout(store), head);
    assert.deepEqual(store.seal(), { ok: false, why: 'refused before' });
});

test('no seal on a read-only chat, during a Re-read or reconcile, or with a damaged record in it', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 9);
    ctx.chat[6].extra.storySuite = { ...ctx.chat[6].extra.storySuite, ops: 'broken' };
    store.rebuild();
    assert.deepEqual(store.seal(), { ok: false, why: 'damaged' });
    const other = sealedSetup({ chat: [{ is_user: false, mes: 'Hi.', swipe_id: 0, extra: { storySuite: { v: 9 } } }] });
    other.store.ensureInitial({ v: 2, meta: { rev: 0, claims: {} }, domains: {} });
    assert.equal(other.store.seal().ok, false);
});

test('a second seal moves the edge on and builds its base from the first one', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 9);
    store.seal();
    grow(ctx, store, 4, 9);
    const before = readout(store);
    assert.equal(store.seal().sealed, 10);
    assert.equal(readout(store), before);
    assert.equal(readout(reload(ctx).store), before);
});

test('a Problem in the sealed replies rides with the base: the Problems read the same after the seal, from the base and after a reload', () => {
    const { ctx, store } = sealedSetup();
    grow(ctx, store, 9);
    // A change on reply 2 that no longer applies (a write under a domain the state does not have): skipped and listed, block by block.
    const record = ctx.chat[4].extra.storySuite;
    ctx.chat[4].extra.storySuite = { ...record, ops: record.ops.map((op, n) => (n === 1 ? { op: 'replace', path: '/domains/nowhere/deep/x', value: 1 } : op)) };
    store.rebuild();
    const problems = JSON.stringify(store.problems().map(({ message, ...rest }) => { void message; return rest; }));
    assert.ok(store.problems().some(problem => problem.index === 4), 'the reply\'s Problem is listed');
    assert.equal(store.seal().ok, true);
    assert.equal(JSON.stringify(store.problems().map(({ message, ...rest }) => { void message; return rest; })), problems);
    assert.ok(ctx.meta.storySuite.base.carried.length >= 1, 'the base carries it');
    const again = reload(ctx);
    assert.equal(JSON.stringify(again.store.problems().map(({ message, ...rest }) => { void message; return rest; })), problems);
});
