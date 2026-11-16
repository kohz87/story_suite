// §2.2 "save-point restore": returning to a save point opens its branch with the metadata it was saved with; the settle blocks are checked again (the epoch
// changed) and stay; the session is the one saved, with no staged step lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createSavePoints } from '../../../src/v2/rewind.js';
import { GO, activeSettles, box, iaApi, iaChain, iaModule } from '../qa/helpers/probe-interaction.js';

const clone = value => structuredClone(value);

test('returning to a save point restores its session and keeps its settle blocks active', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api, { segments: 1 });
        api.stage(box(host).open.id, GO);
        // SillyTavern 1.19's createBranch: chat[0..index] with a copy of the chat's metadata (the session as it was then).
        const branches = {};
        host.ctx.saveMetadata = async () => {};
        const points = createSavePoints({ ctx: host.ctx, store: host.store, live: () => host.ctx, now: () => 0,
            createBranch: async index => { const name = `${host.ctx.chatId} - Branch #1`; host.st.chats[name] = clone(host.ctx.chat.slice(0, index + 1)); branches[name] = clone(host.ctx.chatMetadata); return name; },
            open: async name => { host.ctx.chatMetadata = clone(branches[name]); await host.st.loadChat(host.st.chats[name], name); } });
        const saved = await points.save({ name: 'Here' });
        assert.equal(saved.ok, true, saved.message);
        const open = clone(box(host).open);
        box(host).open.steps = [];   // the reader went on and unstaged it
        box(host).open.offset = 7;
        assert.equal((await points.returnTo(saved.point.id)).ok, true);
        assert.deepEqual(box(host).open, open, 'the saved session, with its staged step');
        assert.equal(activeSettles(host).length, 1, 'the settle block is checked again and stays');
        assert.equal(host.head().domains.ia.bag, activeSettles(host)[0].result.total);
    } finally { host.close(); }
});
