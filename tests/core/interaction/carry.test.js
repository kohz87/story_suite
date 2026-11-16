// An open interaction carries its next setup and returns to its base when the carrying receipt goes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../core/replay.js';
import { receiveSegment, reconcileSession } from '../../../core/interaction/carry.js';

const payload = {
    v: 1, kindId: 'test/probe', version: 1, key: 'i:reply-1%3A0%3Atest%2Fprobe:reply-1:0',
    id: 'reply-1:0:test/probe', anchor: 'reply-1', seed: 11, offset: 0, setup: { room: 1 },
    steps: [{ inputs: [{ actor: 'hero', choice: 'go' }] }], witness: { offset: 0, hash: 'b'.repeat(64) },
    player: 'hero', policy: { choosers: 'own', party: false },
};
const kind = { carry: true, next: (setup, result) => ({ room: setup.room + 1, opened: result.door }) };

test('an unfinished result opens the next segment on its reply with prior, carried key and base', () => {
    const meta = { open: { id: payload.id, origin: 'reply-1', attempt: 0 } };
    const result = { stop: 'open', door: 2 };
    assert.equal(receiveSegment(meta, kind, payload, result, 'reply-2', 'receipt-1', {}), true);
    assert.deepEqual(meta.open.setup, { room: 2, opened: 2 });
    assert.equal(meta.open.anchor, 'reply-2');
    assert.equal(meta.open.offset, 1);
    assert.deepEqual(meta.open.steps, []);
    assert.equal(meta.open.carried, 'receipt-1');
    assert.equal(meta.open.carriedKey, payload.key);
    assert.equal(meta.open.prior, hashJson(result));
    assert.deepEqual(meta.open.base, { offset: 0, anchor: 'reply-1', setup: { room: 1 } });
    assert.deepEqual(meta.last, payload);
});

test('a finished result clears the open segment; a missing carrier restores base or invalidates staged steps', () => {
    const meta = { open: { id: payload.id } };
    assert.equal(receiveSegment(meta, kind, payload, { stop: 'won' }, 'reply-2'), true);
    assert.equal(meta.open, undefined);

    const carried = {
        ...structuredClone(payload), anchor: 'reply-2', offset: 1, setup: { room: 2 }, steps: [],
        base: { offset: 0, anchor: 'reply-1', setup: { room: 1 } }, carried: 'receipt-1', carriedKey: payload.key,
        prior: hashJson({ stop: 'open' }), witness: { offset: 1, hash: 'c'.repeat(64) },
    };
    const restored = { open: structuredClone(carried) };
    reconcileSession(restored, () => false);
    assert.equal(restored.open.offset, 0);
    assert.equal(restored.open.anchor, 'reply-1');
    assert.deepEqual(restored.open.setup, { room: 1 });
    assert.equal(restored.open.carried, undefined);
    assert.equal(restored.open.witness, undefined);

    const invalid = { open: { ...structuredClone(carried), steps: payload.steps } };
    reconcileSession(invalid, () => false);
    assert.equal(invalid.open.invalidated, true);
    reconcileSession(invalid, () => true);
    assert.equal(invalid.open.invalidated, undefined);
});
