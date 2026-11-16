// §2.2 "hand edit of a settled reply's text": a text-only edit goes through the host's reply path and the settle keeps its payload and result; a hand edit
// of the stored payload itself breaks the guard's `setup` hash: the block stays off and the store names the saved kind as damaged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { readRecord } from '../../../core/persist.js';
import { activeSettles, iaApi, iaChain, iaModule } from '../../../packages/story-block/tests/v2/qa/helpers/probe-interaction.js';

test('a text-only edit of a settled reply keeps the settle: same payload, same result, same change', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host), bag = host.head().domains.ia.bag;
        await host.st.editMessage(s[0], 'S1, with the words changed by hand.');
        assert.deepEqual(activeSettles(host), before);
        assert.equal(host.head().domains.ia.bag, bag);
        assert.equal(host.store.problems().length, 0);
    } finally { host.close(); }
});

test('a hand edit of the stored payload breaks the guard: the block stays off and the damage is named', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const record = readRecord(host.ctx.chat[s[0]]);
        for (const span of record.spans) if (span.recorded?.setup) span.recorded.setup.door = 'south';
        await host.turn.onChatChanged();
        assert.equal(host.head().domains.ia.bag, 0, 'the block applies nothing');
        assert.match(host.store.problems().map(item => item.why).join(' '), /saved Probe is damaged/);
    } finally { host.close(); }
});
