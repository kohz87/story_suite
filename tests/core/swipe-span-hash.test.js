// F8W-9: a span's boundary hashes (prefixHash, payloadHash) are witnesses of the reply text. A reply's change block moves into the hidden comment
// after its blocks are stamped, so prose the model left after the block (a copy of the hidden marker, defanged) joined the text the hashes cover
// and left them stale. They are now stamped again once the text is final (store.restampHashes, live and Re-read), so none is stale; the diagnostic
// store.boundaryProblems() and Re-read's source preservation (which compares a block's payloadHash with the reply's) read true ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { payloadHashOf } from '../../core/store/digest.js';
import { guarded } from './helpers/guarded.js';
import { NATIVE, clone, nativeModule } from './helpers/timeline.js';

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

const TRAILING = 'Dawn.\n\n<Changes>\n! tick 6\n! quick th_questone\n</Changes>\n<!-- STORY_SUITE_V2 x -->';

test('a reply with a marker copy after its block has no stale hash live, and a Re-read keeps it that way', async t => {
    const host = await createHost({ modules: [guarded()], core: false });
    t.after(() => host.close());
    await host.send('Go.', TRAILING);
    await host.store.flush();
    assert.deepEqual(host.store.boundaryProblems(), [], 'stamped from the final text');
    const at = host.ctx.chat.length - 1;
    assert.equal(spansOf(host.ctx.chat[at]).every(span => span.boundaries[0].payloadHash === payloadHashOf(host.ctx.chat[at])), true);
    const live = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(JSON.stringify(host.head()), live);
    assert.deepEqual(host.store.boundaryProblems(), []);
});

test('Re-read with a native checkpoint on the reply keeps the block Sources (its payloadHash is the reply\'s)', async t => {
    const native = nativeModule();
    const host = await createHost({ modules: [guarded(), native.def] });
    t.after(() => host.close());
    await host.send('Go.', TRAILING);
    const at = host.ctx.chat.length - 1;
    const sources = () => JSON.stringify(spansOf(host.ctx.chat[at]).map(span => span.source));
    const before = sources();
    const head = await host.sdk.timeline.head();
    const made = await native.native.handle.nativeMutation({
        participant: NATIVE, source: host.store.sourceAt(host.store.headIndex()), expectedHead: head.headHash,
        prepare: async () => {
            const was = native.native.checkpoint();
            const next = clone(native.native.store);
            next.dossiers.tavi.trust = 9;
            const after = native.native.keep(next);
            native.native.prepared.pr_manual001 = { checkpoint: after.checkpoint };
            return { before: { module: NATIVE, ...was, schema: 1 }, after: { module: NATIVE, ...after, schema: 1 }, prepared: 'pr_manual001' };
        },
    });
    assert.equal(made.ok, true, JSON.stringify(made));
    assert.equal(host.timeline.hasNativeChanges(), true);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(sources(), before, 'the Sources are kept');
    assert.equal(native.native.store.dossiers.tavi.trust, 9);
});
