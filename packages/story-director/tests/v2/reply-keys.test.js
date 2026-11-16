// The keys of per-reply entries (src/v2/reply-keys.js): `<sid>.<n>` from the reply's record ID, a count past the reply's highest,
// the older `<rev>.<n>` form without a record ID, and the order by what an entry holds, never by key.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REPLY_KEY, entryOrder, replyKey } from '../../src/v2/reply-keys.js';

test('a key is the reply\'s record ID and a count one past the highest that reply holds', () => {
    const ctx = { rev: 40, carrier: { sid: 'sw_abc123def456' } };
    assert.equal(replyKey(ctx, {}), 'sw_abc123def456.0');
    assert.equal(replyKey(ctx, { 'sw_abc123def456.0': {}, '40.0': {}, 'sw_other.7': {} }), 'sw_abc123def456.1');
    // An entry pruned from the front: its count is not used again (it would sort first).
    assert.equal(replyKey(ctx, { 'sw_abc123def456.2': {} }), 'sw_abc123def456.3');
    // A command that is not a capture: the reply its changes are stored on.
    assert.equal(replyKey({ rev: 9, reply: { index: 4, sid: 'sw_head' } }, {}), 'sw_head.0');
    // An arc plan's lines run as a reply of their own.
    assert.equal(replyKey({ rev: 9, carrier: { sid: 'plan:ar_x1' } }, { 'plan:ar_x1.0': {} }), 'plan:ar_x1.1');
});

test('without a record ID the older <rev>.<n> form is used, the first free count', () => {
    assert.equal(replyKey({ rev: 7 }, {}), '7.0');
    assert.equal(replyKey({ rev: 7, carrier: { key: '3:0' } }, { '7.0': {}, '7.1': {} }), '7.2');
    assert.equal(replyKey({}, {}), '0.0');
    assert.equal(replyKey({ rev: 7, carrier: { sid: '' } }, {}), '7.0');
});

test('both key forms pass the key rule; nothing else does', () => {
    for (const key of ['12.0', '0.3', 'sw_abc123def456.0', 'plan:ar_x1.12']) assert.ok(REPLY_KEY.test(key), key);
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
