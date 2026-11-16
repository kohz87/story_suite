// The gap between time lines and the tail's reminder at three replies, and `time.lastLine` over the receipts.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GAP_REPLIES, gapCue, replyGap } from '../../../src/v2/time/line-gap.js';
import { lastLineQuery } from '../../../src/v2/time/index-parts/queries.js';

test('replyGap counts whole replies since the last time line, the reader\'s message last', () => {
    // greeting 0, user 1, reply 2 (time line), user 3, reply 4, user 5, reply 6, user 7: next reply is index 8.
    assert.equal(replyGap(3, 2), 0);
    assert.equal(replyGap(6, 2), 1);
    assert.equal(replyGap(8, 2), 2);
    assert.equal(replyGap(10, 2), 3);
    assert.equal(replyGap(10, null), 4);
    assert.equal(replyGap(undefined, 2), 0);
    assert.equal(replyGap(1, 5), 0);
});

test('the cue appears at three replies and says how many', () => {
    assert.equal(GAP_REPLIES, 3);
    assert.equal(gapCue(2), '');
    assert.equal(gapCue(3), 'Story time: no time line for 3 replies; if time has passed, write ~ time <clock> or ! time +<how long>.');
    assert.match(gapCue(5), /for 5 replies/);
});

test('time.lastLine is the highest chat index of a capture.time or director.advance receipt', () => {
    const receipts = () => [{ index: 2, receipt: { type: 'capture.time' } }, { index: 4, receipt: { type: 'dm.tick' } }, { index: 6, receipt: { type: 'director.advance' } }, { index: 5, receipt: { type: 'capture.time' } }];
    assert.deepEqual(lastLineQuery({}, {}, { receipts }), { index: 6 });
    assert.deepEqual(lastLineQuery({}, {}, { receipts: () => [] }), { index: null });
    assert.deepEqual(lastLineQuery({}, {}, {}), { index: null });
    assert.deepEqual(lastLineQuery({}, {}, { receipts: () => { throw new Error('x'); } }), { index: null });
});
