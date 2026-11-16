// §2.2 "ST branch" and "chat change": the new chat gets the metadata and the chat-change prune runs; a session whose anchor is in the branch continues
// there with the same seed; one whose reply is not in the branch is dropped, or set back to what the branch holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../src/v2/persist.js';
import { GO, activeSettles, box, iaApi, iaChain, iaModule } from '../qa/helpers/probe-interaction.js';

test('a branch at the first settled reply sets the carried session back to that reply, with the same seed and attempt', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api);
        const seed = box(host).open.seed;
        await host.ctx.branchChat(s[0]);
        assert.equal(activeSettles(host).length, 1);
        const open = box(host).open;
        assert.equal(open.offset, 1);
        assert.equal(open.anchor, readRecord(host.ctx.chat[s[0]]).sid);
        assert.equal(open.seed, seed);
        assert.equal(api.stage(open.id, GO).ok, true, 'the session plays on in the branch');
    } finally { host.close(); }
});

test('a branch before every settle goes back to the first segment; a branch before the anchor drops the session', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { a } = await iaChain(host, api);
        box(host).held = { gone: { current: { prechecks: [] }, staged: false } };
        await host.ctx.branchChat(a);
        assert.equal(activeSettles(host).length, 0);
        assert.equal(box(host).open.offset, 0);
        assert.equal(box(host).open.anchor, readRecord(host.ctx.chat[a]).sid);
        assert.deepEqual(box(host).held, {}, 'a marker for a reply that is not in the branch is pruned');
        await host.ctx.branchChat(0);
        assert.equal(box(host).open, undefined, 'its anchor is not in this chat');
    } finally { host.close(); }
});
