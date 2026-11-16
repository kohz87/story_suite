// A thread write's id is made from the reply's Source without the ordinal a Re-read gives its blocks fresh (a fight reply is where this showed: its guarded blocks move the ordinal on each Re-read).
import test from 'node:test';
import assert from 'node:assert/strict';
import { threadWriteId } from '../../../../modules/time/tracker/thread-writes.js';

const hashOf = value => [...JSON.stringify(value)].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0');
const ctxFor = source => ({ source, hash: hashOf, fail() { throw new Error('no source'); } });
const source = { sid: 'sr_aaaaaaaa', swipeKey: 'sw_bbbbbbbb', evidence: 'ev_cccccccc' };

test('the writer id does not move with the Source\'s ordinal, and still tells replies and writers apart', () => {
    assert.equal(threadWriteId(ctxFor({ ...source, ordinal: 1 }), 'offer:th_1'), threadWriteId(ctxFor({ ...source, ordinal: 9 }), 'offer:th_1'));
    assert.notEqual(threadWriteId(ctxFor(source), 'offer:th_1'), threadWriteId(ctxFor(source), 'offer:th_2'));
    assert.notEqual(threadWriteId(ctxFor(source), 'offer:th_1'), threadWriteId(ctxFor({ ...source, swipeKey: 'sw_dddddddd' }), 'offer:th_1'));
});
