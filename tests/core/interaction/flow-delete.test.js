// §2.2 "delete (last reply)" and "middle delete": the last delete reconciles the session (base, or invalidated with steps); a middle delete takes
// a block back when what it read changed, and a carried segment when the segment it came from changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { GO, activeSettles, box, codes, iaApi, iaChain, iaModule, playSegment } from '../../../packages/story-block/tests/v2/qa/helpers/probe-interaction.js';

// The reader deletes the last reply and the message it answered.
async function dropLast(host, index) {
    await host.st.deleteMessage(index);
    await host.st.deleteMessage(index - 1);
}

test('deleting the last reply with nothing staged puts the session back to its base, and the same dice play again', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api);
        const second = activeSettles(host)[1];
        await dropLast(host, s[1]);
        assert.equal(activeSettles(host).length, 1);
        assert.equal(box(host).open.offset, 1, 'back to the start of segment 2');
        assert.equal(box(host).open.steps.length, 0);
        await playSegment(host, api, GO, 'go again', 'S2 again.');
        const again = activeSettles(host)[1];
        assert.deepEqual(again.result, second.result, 'the same seed and offset roll the same');
        assert.equal(again.payload.key, second.payload.key);
    } finally { host.close(); }
});

test('deleting the last reply with steps staged marks the session taken back; it refuses to play on', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api);
        assert.equal(api.stage(box(host).open.id, GO).ok, true);
        await dropLast(host, s[1]);
        assert.equal(box(host).open.invalidated, true);
        const staged = api.stage(box(host).open.id, GO);
        assert.equal(staged.ok, false);
        assert.match(staged.message, /taken back/);
        host.st.addUser('again');
        assert.equal(api.send(box(host).open.id).ok, false, 'Send is refused too');
    } finally { host.close(); }
});

test('a middle delete that changes what the first segment read takes both segments back, and says so', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { a } = await iaChain(host, api);
        await host.st.deleteMessage(a);   // A set the lamp the witness read
        assert.equal(activeSettles(host).length, 0);
        assert.equal(host.head().domains.ia.bag, 0, 'no change of a taken-back block stays');
        assert.equal(codes(host).filter(code => code === 'INTERACTION_TAKEN_BACK').length, 2);
        assert.match(host.turn.problems().find(item => item.code === 'INTERACTION_TAKEN_BACK').message, /The Probe was taken back/);
    } finally { host.close(); }
});

test('a middle delete of segment 1 takes segment 2 back, though segment 2 read nothing that changed', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api);
        await host.st.deleteMessage(s[0]);
        assert.equal(activeSettles(host).length, 0);
        assert.match(host.turn.problems().find(item => item.code === 'INTERACTION_TAKEN_BACK').message, /earlier part of the Probe/);
        assert.equal(box(host).open.offset, 0, 'the session is back at the start');
    } finally { host.close(); }
});

test('deleting a plain reply an idle session moved onto puts the session back where it was', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = structuredClone(box(host).open);
        await host.send('Something else.', 'A quiet reply.');   // no settle on it: the open session is moved onto it
        assert.equal(box(host).open.idle, true);
        assert.notEqual(box(host).open.anchor, before.anchor);
        await dropLast(host, host.ctx.chat.length - 1);
        assert.deepEqual(box(host).open, before, 'the interaction is open on the reply it was before');
        assert.equal(box(host).open.anchor, host.store.carrierSid(s[0]));
    } finally { host.close(); }
});

test('two plain replies after a segment: deleting them one at a time walks the session back one reply at a time', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = structuredClone(box(host).open);
        await host.send('Something else.', 'A quiet reply.');
        const afterB = structuredClone(box(host).open);
        await host.send('And again.', 'Another quiet reply.');
        assert.equal(box(host).open.idle, true);
        await dropLast(host, host.ctx.chat.length - 1);
        assert.deepEqual(box(host).open, afterB, 'back on the first quiet reply, as it was live');
        await dropLast(host, host.ctx.chat.length - 1);
        assert.deepEqual(box(host).open, before, 'and back on the segment reply');
        assert.equal(box(host).open.anchor, host.store.carrierSid(s[0]));
    } finally { host.close(); }
});
