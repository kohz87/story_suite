// A deferred domain's first write is stored as changes on its initial slice only when the store seeds (createStore({ seed })):
// a store built without `seed` cannot apply a change under a slice that is not there, so it keeps the one whole `add` (REPLAY.md "Deferred domains").
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/guarded.js';

const later = {
    id: 'zz-first', name: 'First', version: '0.0.1',
    domains: { later: { initial: () => ({ v: 1, n: 0, list: [] }), deferred: true } },
    commands: { 'zz.bump'(ctx) { Object.assign(ctx.draft('later'), { v: 1, n: 2, list: ['a'] }); return { summary: 'Bumped.', narrate: false }; } },
};

function stored(h) {
    return h.chat[0].extra.storySuite;
}

test('a store without seed stores the first write of a deferred domain as one whole add, and the command works', () => {
    const h = harness([later]);
    const result = h.command('zz.bump');
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
    assert.deepEqual(h.store.head().domains.later, { v: 1, n: 2, list: ['a'] });
    const text = JSON.stringify(stored(h));
    assert.match(text, /"path":"\/domains\/later"/);
    assert.doesNotMatch(text, /"path":"\/domains\/later\//);
});

test('a store with seed stores it as changes on the initial slice, and the head is the same', () => {
    const h = harness([later], { seed: name => (name === 'later' ? { v: 1, n: 0, list: [] } : null) });
    const result = h.command('zz.bump');
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
    assert.deepEqual(h.store.head().domains.later, { v: 1, n: 2, list: ['a'] });
    const text = JSON.stringify(stored(h));
    assert.match(text, /"path":"\/domains\/later\/n"/);
    assert.doesNotMatch(text, /"path":"\/domains\/later"/);
});
