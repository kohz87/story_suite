// LIVEPERF finding 1 (LPA): the cast read every pack person again on each prompt build (and capture) and hashed each one for its signature
// (`sig`, what the entry says). A pack's row is frozen and comes back the same on every ask (packs.content), so its signature is hashed
// once per row; a row that is not frozen is hashed each time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readEntry } from '../../../../modules/cast/cast/entries-parts/packs.js';
import { deepFreeze } from '../../../../core/ops/freeze.js';

// A pack row whose `look` (read only by the signature's hash) counts how often it is read.
function counted() {
    let reads = 0;
    const row = { pack: 'ersveil', id: 'velt', name: 'Velt', packVersion: '4.0.0', start: { place: 'Bluewatch' } };
    Object.defineProperty(row, 'look', { enumerable: true, get: () => { reads += 1; return 'Weathered older woman.'; } });
    return { row, reads: () => reads };
}

test('a frozen pack row is hashed once for its signature, however often it is read', () => {
    const { row, reads } = counted();
    deepFreeze(row);
    const first = readEntry(row);
    const after = reads();
    for (let i = 0; i < 5; i++) assert.equal(readEntry(row).sig, first.sig);
    assert.equal(reads(), after, 'the signature is not hashed again');
});

test('a row that is not frozen is hashed on every read, and the signature is what it says (not the pack version)', () => {
    const { row, reads } = counted();
    const sig = readEntry(row).sig;
    const after = reads();
    readEntry(row);
    assert.ok(reads() > after, 'hashed again');
    assert.equal(readEntry({ ...row, packVersion: '9.9.9', look: 'Weathered older woman.' }).sig, sig);
});
