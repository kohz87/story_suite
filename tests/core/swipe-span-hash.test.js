// F8W-9: a span's boundary hashes (prefixHash, payloadHash) are stamp-time witnesses of the reply text. A reply whose text changed after
// a block was stamped (a model's own hidden comment is defanged once the reply is read) leaves that block's hashes stale; they are
// harmless: no state reads them (store.boundaryProblems() is the one reader, a diagnostic that lists the block), so swipe, swipe back, rebuild and
// reload give the state live had. A Re-read of the reply stamps them again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { payloadHashOf } from '../../core/store/digest.js';
import { guarded } from './helpers/guarded.js';

const REPLY = n => `Dawn.\n\n<Changes>\n! tick ${n}\n! quick th_questone\n</Changes>`;
const spansOf = message => message.extra.storySuite.spans.filter(span => span.boundaries);

test('stale span hashes change no state through swipe, swipe back, rebuild and reload; Re-read stamps them again', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', REPLY(90));
    const first = host.ctx.chat.length - 1;
    await host.store.flush();
    const live = JSON.stringify(host.head());
    const fresh = spansOf(host.ctx.chat[first]).map(span => span.boundaries[0].payloadHash);
    assert.deepEqual(fresh, [payloadHashOf(host.ctx.chat[first])], 'stamped from the text');
    for (const span of spansOf(host.ctx.chat[first])) { span.boundaries[0].payloadHash = 'ab'.repeat(32); span.boundaries[0].prefixHash = 'cd'.repeat(32); }
    assert.equal(host.store.boundaryProblems().length, 1, 'the diagnostic lists the stale block');
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, 'a stale hash changes no state');
    await host.swipe(REPLY(10));
    await host.store.flush();
    assert.notEqual(JSON.stringify(host.head()), live, 'the swipe is its own reply');
    await host.st.swipeTo(first, 0);
    await host.store.flush();
    assert.equal(JSON.stringify(host.head()), live, 'swipe back equals live');
    // SillyTavern's "swipe that is not a string" warning (ensureSwipes): Story Suite leaves every swipe a string with its swipe_info beside it.
    const message = host.ctx.chat[first];
    assert.equal(message.swipes.every(swipe => typeof swipe === 'string'), true);
    assert.equal(message.swipe_info.length, message.swipes.length);
    assert.equal(message.swipe_info.every(info => info && typeof info === 'object'), true);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, 'rebuild equals live');
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), live, 'reload equals live');
    const result = await host.turn.reread(first);
    assert.equal(result.ok, true, result.message);
    assert.equal(JSON.stringify(host.head()), live, 'Re-read equals live');
    assert.deepEqual(host.store.boundaryProblems(), [], 'stamped again');
});
