// The keys of per-reply entries (src/v2/reply-keys.js): `<sid>.<n>` from the reply's record ID, a count past the reply's highest,
// the older `<rev>.<n>` form without a record ID, and the order by what an entry holds, never by key.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REPLY_KEY, entryOrder, replyKey } from '../../modules/world/reply-keys.js';
import { newRecordId } from '../../core/persist.js';

test('a reply\'s own story is keyed by its record ID and a count one past the highest that reply holds', () => {
    const ctx = { cause: 'story', rev: 40, receiptId: 'rc_aaaa1111', carrier: { sid: 'sw_abc123def456' }, reply: { index: 4, sid: 'sw_abc123def456' } };
    assert.equal(replyKey(ctx, {}), 'sw_abc123def456.0');
    assert.equal(replyKey(ctx, { 'sw_abc123def456.0': {}, '40.0': {}, 'sw_other.7': {}, 'sw_abc123def456:rc_x.4': {} }), 'sw_abc123def456.1');
    // An entry pruned from the front: its count is not used again (it would sort first).
    assert.equal(replyKey(ctx, { 'sw_abc123def456.2': {} }), 'sw_abc123def456.3');
});

test('a write that is not the reply\'s own story is keyed by the reply and its receipt, apart from the reply\'s own keys', () => {
    // A click or a step kept on reply S: a Re-read of S writes S.0, S.1, … again and keeps this one as stored, so it must not be S.<n>.
    const click = { cause: 'ui', rev: 9, receiptId: 'rc_b2c3d4e5', reply: { index: 4, sid: 'sw_head' } };
    assert.equal(replyKey(click, { 'sw_head.0': {}, 'sw_head.1': {} }), 'sw_head:rc_b2c3d4e5.0');
    assert.equal(replyKey(click, { 'sw_head:rc_b2c3d4e5.0': {} }), 'sw_head:rc_b2c3d4e5.1');
    assert.equal(replyKey({ cause: 'system', rev: 9, reply: { index: 4, sid: 'sw_head' } }, {}), 'sw_head:r9.0');
    // An arc plan's lines run with a carrier of their own (`plan:<arc>`), shared by every reply: the reply and receipt are used instead.
    assert.equal(replyKey({ cause: 'ui', rev: 9, receiptId: 'rc_f00d', carrier: { sid: 'plan:ar_x1' }, reply: { index: 6, sid: 'sw_late' } }, {}), 'sw_late:rc_f00d.0');
});

test('Story Block\'s record IDs are used as they are (never the older fallback)', () => {
    for (let i = 0; i < 20; i += 1) {
        const sid = newRecordId();
        assert.equal(replyKey({ cause: 'story', rev: 3, carrier: { sid } }, {}), `${sid}.0`);
        assert.equal(replyKey({ cause: 'ui', rev: 3, receiptId: 'rc_a1b2c3d4', reply: { sid } }, {}), `${sid}:rc_a1b2c3d4.0`);
    }
});

test('without a record ID the older <rev>.<n> form is used, the first free count', () => {
    assert.equal(replyKey({ rev: 7 }, {}), '7.0');
    assert.equal(replyKey({ rev: 7, carrier: { key: '3:0' } }, { '7.0': {}, '7.1': {} }), '7.2');
    assert.equal(replyKey({}, {}), '0.0');
    assert.equal(replyKey({ rev: 7, carrier: { sid: '' } }, {}), '7.0');
});

test('both key forms pass the key rule; nothing else does', () => {
    for (const key of ['12.0', '0.3', 'sw_abc123def456.0', 'sw_head:rc_b2c3d4e5.12']) assert.ok(REPLY_KEY.test(key), key);
    for (const key of ['x', '12', '.0', 'sw_a.', 'sw_a.b', '_a.0', '1x.0', 'a b.0', `${'a'.repeat(81)}.0`]) assert.ok(!REPLY_KEY.test(key), key);
});

test('entries are ordered by what they hold, then the key\'s count, then the key; old and new keys mix', () => {
    const order = entryOrder(entry => [entry.turn, entry.rev]);
    const map = {
        'sw_b.1': { turn: 3, rev: 9 },
        '11.0': { turn: 2, rev: 11 },
        'sw_b.0': { turn: 3, rev: 9 },
        'sw_a.10': { turn: 4, rev: 2 },
        'sw_a.2': { turn: 4, rev: 2 },
        '5.0': { turn: 1, rev: 5 },
        'sw_z.0': { rev: 1 },
    };
    assert.deepEqual(Object.entries(map).sort(order).map(([key]) => key), ['sw_z.0', '5.0', '11.0', 'sw_b.0', 'sw_b.1', 'sw_a.2', 'sw_a.10']);
});
