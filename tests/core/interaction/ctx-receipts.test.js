// A command's ctx `receipts()` (commands/ctx.js): the stored receipts in chat order as the transaction sees them, which an interaction segment uses
// to find the receipt of the segment it was carried from; refused once the command is finished.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';

let kept = null;
const module = { id: 'rc-probe', name: 'RC Probe', version: '0.0.0', commands: { 'rc.count': (ctx) => { kept = ctx; return { summary: String(ctx.receipts().length), narrate: false }; } } };

test('ctx.receipts() lists the stored receipts, and its ctx cannot be used after the command ends', async () => {
    const host = await createHost({ modules: [module] });
    try {
        await host.send('Hello.', 'A.\n\n<Changes>\n+ item Rope\n</Changes>');
        await host.send('Again.', 'B.\n\n<Changes>\n+ item Lamp\n</Changes>');
        const stored = host.store.receipts().length;
        const run = host.bus.run('rc.count', {}, { cause: 'system' });
        assert.equal(run.ok, true);
        assert.equal(Number(run.receipt.summary), stored, 'the same receipts the store holds');
        assert.throws(() => kept.receipts(), /already finished/);
    } finally { host.close(); }
});
