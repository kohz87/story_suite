// §2.2 "reload": the chat metadata survives; the session, its staged steps and the settled story come back as they were (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { GO, box, iaApi, iaChain, iaModule } from '../../suite/qa/helpers/probe-interaction.js';

test('a reload keeps the staged session and gives the same story state', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api);
        api.stage(box(host).open.id, GO);
        const open = structuredClone(box(host).open), head = structuredClone(host.head()), current = api.current();
        await host.turn.onChatChanged();
        assert.deepEqual(box(host).open, open, 'the staged session is untouched');
        assert.deepEqual(host.head(), head, 'the settled changes replay to the same state');
        assert.deepEqual(api.current(), current);
        assert.equal(api.current().canSend, true);
    } finally { host.close(); }
});

test('a reload from the saved chat file replays the settles the same (the chat as saved is opened again)', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api);
        const head = structuredClone(host.head()), open = structuredClone(box(host).open);
        await host.st.loadChat(host.st.saved() ?? host.ctx.chat);
        assert.deepEqual(host.head(), head);
        assert.deepEqual(box(host).open, open);
    } finally { host.close(); }
});
