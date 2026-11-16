// §2.2 "rewind": the store truncates; a kept settle block whose guard does not hold stays stored and inactive and does not refuse the rewind; the
// session is reconciled against what is left, and held markers of replies that are gone are pruned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { activeSettles, box, iaApi, iaChain, iaKind, iaModule } from '../qa/helpers/probe-interaction.js';

const settleEntry = (host, n) => host.store.receipts().filter(entry => entry.receipt.type === 'interaction.settle')[n];

test('a rewind to before a settle takes it off the line and sets the session back to what is left', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api);
        const second = settleEntry(host, 1);
        const done = await host.sdk.rewind({ index: second.index, beforeRev: second.receipt.rev });
        assert.equal(done.ok, true, done.message);
        assert.equal(activeSettles(host).length, 1);
        assert.equal(box(host).open.offset, 1, 'the session is back at the start of segment 2');
        assert.equal(box(host).open.steps.length, 0);
    } finally { host.close(); }
});

test('a rewind over a settle block that is inactive (its kind is not ready) does not refuse', async () => {
    const flag = { on: true };
    const host = await createHost({ modules: [iaModule({ kind: iaKind({ ready: () => flag.on }) })] });
    try {
        const api = iaApi(host);
        await iaChain(host, api);
        flag.on = false;
        await host.turn.onChatChanged();   // replay checks the guards again: the blocks are kept but off (NOT_READY)
        assert.equal(host.head().domains.ia.bag, 0, 'the inactive blocks apply nothing');
        const second = settleEntry(host, 1) ?? host.store.receipts().at(-1);
        const done = await host.sdk.rewind({ index: second.index, beforeRev: second.receipt.rev });
        assert.equal(done.ok, true, done.message);
    } finally { host.close(); }
});

test('held markers of replies that a rewind removed are pruned from the metadata', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api);
        const second = settleEntry(host, 1);
        box(host).held = { gone_sid: { current: { prechecks: [] }, staged: false } };
        box(host).heldDiscarded = { gone_sid: true };
        await host.sdk.rewind({ index: second.index, beforeRev: second.receipt.rev });
        assert.deepEqual(box(host).held, {});
        assert.deepEqual(box(host).heldDiscarded, {});
    } finally { host.close(); }
});
