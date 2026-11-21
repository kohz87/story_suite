// Sealed history, the record (persist/sealed.js): what a sealed record keeps and drops, that this build reads it as its own, and that a
// build from before it (which knows records up to v2) sees a newer version's record and so keeps the chat read-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSealed, sealRecord, SEALED_V } from '../../core/persist/sealed.js';
import { readRecord, recordFault } from '../../core/persist.js';
import { createTombs } from '../../core/store/tombs.js';
import { grow, sealedSetup } from './seal.helpers.js';

const v2 = () => ({ v: 2, sid: 'sw_1', swipe: 0, rev: 4, rules: ['x'], foeCap: 20, source: { logical: 'sr_1', swipeKey: 'sw_1', evidence: 'ev_1' },
    ops: [{ op: 'replace', path: '/meta/rev', value: 4 }], spans: [{ n: 1, story: false }], narrated: ['rc_1'],
    receipts: [{ id: 'rc_1', rev: 4, summary: 'A thing.', seed: 9, replan: { payload: {} }, data: { v2: { result: { kind: 'k' } }, shown: 'x' } }],
    checkpoint: { v: 2, meta: { rev: 0, claims: {} }, domains: {} }, covers: [], prefix: 'p', guardEnv: 'g', carried: [], owned: [] });

test('a sealed record keeps ids, marks and receipts (display data and data.v2) and drops what only replay reads', () => {
    const sealed = sealRecord(v2());
    assert.equal(sealed.v, SEALED_V);
    assert.equal(sealed.sealed, 1);
    assert.deepEqual([sealed.ops, sealed.spans], [[], []]);
    for (const field of ['checkpoint', 'covers', 'prefix', 'guardEnv', 'carried', 'owned']) assert.equal(Object.hasOwn(sealed, field), false, field);
    assert.deepEqual([sealed.sid, sealed.rev, sealed.rules, sealed.foeCap, sealed.narrated, sealed.source.logical], ['sw_1', 4, ['x'], 20, ['rc_1'], 'sr_1']);
    assert.deepEqual(sealed.receipts, [{ id: 'rc_1', rev: 4, summary: 'A thing.', data: { v2: { result: { kind: 'k' } }, shown: 'x' } }]);
    assert.equal(isSealed(sealed), true);
    assert.equal(sealRecord(sealed), sealed, 'sealing twice changes nothing');
    assert.throws(() => sealRecord({ v: 1 }), /Only a story record/);
});

test('this build reads a sealed record as its own: readRecord returns it, it is no fault, and rawKind calls it ours', () => {
    const message = { is_user: false, mes: 'Old reply.', swipe_id: 0, extra: { storySuite: sealRecord(v2()) } };
    assert.equal(readRecord(message), message.extra.storySuite);
    assert.equal(recordFault(message), '');
    const { rawKind } = createTombs({}, { chatId: () => 'c', metadata: () => null, current: () => ({}), list: () => [], sealedKept: () => null });
    assert.equal(rawKind(message.extra.storySuite), 'ours');
    assert.equal(rawKind({ ...message.extra.storySuite, sealed: 0 }), 'future', 'any other v3 record is still a newer version\'s');
    assert.equal(isSealed({ ...message.extra.storySuite, ops: [{ op: 'add' }] }), false, 'a sealed record has no changes of its own');
});

test('the fence: an older build (records up to v2) finds the sealed greeting a newer version\'s record and keeps the chat read-only', () => {
    const { ctx, store } = sealedSetup({ meta: { integrity: 'f1' } });
    grow(ctx, store, 9);
    assert.equal(store.seal().ok, true);
    const first = ctx.chat[0].extra.storySuite;
    assert.equal(first.v, SEALED_V, 'the greeting is always sealed in a sealed chat');
    // The rawKind of the builds before this one: v > 2 is 'future', and a future first record makes the chat read-only (store/tombs.js preservedAt).
    const older = raw => (Number.isFinite(raw.v) && raw.v > 2 ? 'future' : raw.v === 2 ? 'ours' : 'legacy');
    assert.equal(older(first), 'future');
    // New replies are still written as v2.
    const last = ctx.chat.findLast(message => !message.is_user).extra.storySuite;
    assert.equal(last.v, 2);
});
