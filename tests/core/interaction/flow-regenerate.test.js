// §2.2 "regenerate": the staged session, then the Send copy, then the last payload, but only when the reader's message is linked to its key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../core/persist.js';
import { activeSettles, box, iaApi, iaChain, iaModule } from '../../suite/qa/helpers/probe-interaction.js';

test('a regenerate of a linked reply settles the same payload and result again', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        const before = activeSettles(host)[0], link = host.ctx.chat[s[0] - 1].extra.storySuiteInteractionLinks;
        assert.deepEqual(Object.keys(link), [before.payload.key], 'the reader\'s message is linked to the payload key');
        const done = await host.regenerate('S1, regenerated.');
        const after = activeSettles(host);
        assert.equal(after.length, 1);
        assert.deepEqual(after[0].payload, before.payload);
        assert.deepEqual(after[0].result, before.result);
        assert.equal(after[0].index, done.index);
        assert.equal(box(host).open.offset, 1);
        assert.equal(box(host).open.anchor, readRecord(host.ctx.chat[done.index]).sid);
    } finally { host.close(); }
});

test('a regenerate of a message that is not linked settles nothing', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
        delete host.ctx.chat[s[0] - 1].extra.storySuiteInteractionLinks;
        await host.regenerate('S1, regenerated.');
        assert.equal(activeSettles(host).length, 0, 'no settle: the old fight is not carried to a message it was not sent with');
        assert.equal(host.head().domains.ia.bag, 0);
    } finally { host.close(); }
});
