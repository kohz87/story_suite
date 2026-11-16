// §2.2 "generate (normal)": a staged interaction holds the reader's send until Send, then its settle is a prelude of the reply, told to the narrator,
// stored on the reply with its changes, and the session moves on (carry) or ends. Runs on the real host with the test-only probe module.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../core/persist.js';
import { STATIC_KEY } from '../../../core/turn.js';
import { GO, IA_KIND, WAIT, iaApi, iaModule, playSegment } from '../../suite/qa/helpers/probe-interaction.js';

const settleOf = (host, index) => readRecord(host.ctx.chat[index]).receipts.filter(receipt => receipt.type === 'interaction.settle');

test('a staged interaction holds the send; after Send the settle is stored on the reply, told in the tail and moves the session on', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        await host.send('Hello.', 'The door is north.');
        const api = iaApi(host), id = api.open(IA_KIND).id;
        assert.equal(api.stage(id, GO).ok, true);
        host.st.addUser('I go.');
        const held = await host.st.generate('normal', { reply: '' });
        assert.equal(held.aborted, true, 'no Send yet: the reply is held');
        assert.match(host.turn.blocked().at(-1).reason, /Play the waiting Probe/);
        assert.equal(api.send(id).ok, true);
        const done = await host.regenerate('He goes.');
        const [settle] = settleOf(host, done.index);
        assert.equal(settle.replan.payload.kindId, IA_KIND);
        assert.deepEqual(settle.replan.payload.steps, [GO], 'only the reader chose; the companion is derived, never stored');
        assert.equal(settle.data.v2.result.mate, 'hum');
        assert.equal(host.head().domains.ia.bag, settle.data.v2.result.total, 'the settled change applied through its command');
        assert.match(JSON.stringify(host.st.requests.at(-1)), /\[Happened\]\\nProbe round 0: go/, 'the note is told to the narrator');
        assert.doesNotMatch(host.st.promptLog.findLast(entry => entry.key === STATIC_KEY).value, /Probe/, 'no static text of its own');
        const box = host.ctx.chatMetadata.storySuiteInteraction;
        assert.equal(box.send, undefined, 'the Send copy is cleared once the reply is received');
        assert.equal(box.open.offset, 1, 'an open result carries the next segment');
        assert.equal(box.open.anchor, readRecord(host.ctx.chat[done.index]).sid);
    } finally { host.close(); }
});

test('a segment that ends (stop done) closes the session', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        await host.send('Hello.', 'The door is north.');
        const r = await playSegment(host, iaApi(host), WAIT, 'I wait.', 'Nothing happens.');
        assert.equal(settleOf(host, r.index)[0].data.interaction.stop, 'done');
        assert.equal(host.ctx.chatMetadata.storySuiteInteraction.open, undefined);
    } finally { host.close(); }
});

test('a settle that cannot be prepared holds the send with the reason', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        await host.send('Hello.', 'The door is north.');
        const api = iaApi(host), id = api.open(IA_KIND).id;
        api.stage(id, GO);
        host.st.addUser('I go.');
        await host.st.generate('normal', { reply: '' });
        api.send(id);
        await host.sdk.command('ia.set', { key: 'lamp', value: 2 });   // what the interaction read changed after Send
        const out = await host.st.generate('regenerate', { reply: 'He goes.' });
        assert.equal(out.aborted, true);
        assert.match(host.turn.blocked().at(-1).reason, /changed/);
    } finally { host.close(); }
});
