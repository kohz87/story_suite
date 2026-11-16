// §2.2 "swipe": the payload is read from the reply's own earlier swipe, so the same seed, steps, witness and result come back; the live session
// is not used and keeps its staged steps; a swipe checks payload.witness again. Real host, test-only probe module.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../src/v2/persist.js';
import { GO, IA_KIND, activeSettles, box, codes, iaApi, iaChain, iaModule } from '../qa/helpers/probe-interaction.js';

test('a swipe settles the same seed, steps and result, and the session stays', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host), open = structuredClone(box(host).open), bag = host.head().domains.ia.bag;
        await host.swipe('S1, another way.');
        const after = activeSettles(host);
        assert.equal(after.length, 1);
        assert.deepEqual(after[0].payload, before[0].payload, 'the same recorded payload: seed, steps, witness, player');
        assert.deepEqual(after[0].result, before[0].result, 'the same result, the same dice');
        assert.equal(host.head().domains.ia.bag, bag, 'the same change, applied once');
        assert.equal(after[0].index, s[0]);
        // (the new swipe is its own reply record: the session follows it, and is otherwise unchanged)
        const now = box(host).open;
        assert.equal(now.anchor, host.store.carrierSid(host.store.headIndex()));
        assert.deepEqual({ ...now, anchor: 0, carried: 0 }, { ...open, anchor: 0, carried: 0 }, 'the carried session is unchanged by a swipe');
    } finally { host.close(); }
});

test('a swipe keeps the steps staged for the next segment', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api, { segments: 1 });
        assert.equal(api.stage(box(host).open.id, GO).ok, true);
        await host.swipe('S1, once more.');
        assert.equal(box(host).open.steps.length, 1, 'the staged step is still there');
        assert.equal(box(host).open.offset, 1);
    } finally { host.close(); }
});

test('a swipe re-checks the recorded witness: a payload that no longer matches what it read is held with the reason', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        // The earlier swipe's stored payload is hand-edited (the door it was played at): its witness no longer matches.
        host.ctx.chat[s[0]].extra.storySuite.receipts.find(receipt => receipt.type === 'interaction.settle').replan.payload.setup.door = 'south';
        const out = await host.st.generate('swipe', { reply: 'S1, again.' });
        assert.equal(out.aborted, true, 'the swipe did not go out');
        assert.match(host.turn.blocked().at(-1).reason, /changed/);
        assert.equal(codes(host).includes('NO_LONGER_DONE'), false, 'held by canGenerate, before any prelude was previewed');
        assert.equal(host.head().domains.ia.bag, 0, 'nothing of the swipe was settled');
        assert.equal(IA_KIND, 'ia-probe/probe');
    } finally { host.close(); }
});

test('swiping back to an earlier swipe keeps the carried session: the same segment is on the line under another reply and receipt', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const open = structuredClone(box(host).open);
        await host.swipe('S1, another way.');
        await host.st.swipeTo(s[0], 0);
        const now = box(host).open;
        assert.equal(now.anchor, readRecord(host.ctx.chat[s[0]]).sid, 'it follows the swipe shown');
        assert.equal(now.invalidated, undefined);
        assert.deepEqual({ ...now, anchor: 0, carried: 0 }, { ...open, anchor: 0, carried: 0 }, 'offset, setup, seed and carry are those of the live session');
        assert.equal(api.stage(now.id, GO).ok, true, 'the reader can play on');
        await host.st.swipeTo(s[0], 1);
        assert.equal(box(host).open.steps.length, 1, 'a staged step survives a flip to the other swipe too');
        assert.equal(box(host).open.invalidated, undefined);
        assert.equal(activeSettles(host).length, 1);
    } finally { host.close(); }
});
