// §2.2 "reader edit while a reply is in flight", "reload" (held marker) and Re-read of a held reply: a reply whose interaction can no longer be settled
// stays uncaptured until what it read is restored or the interaction is discarded; the marker survives a reload; Re-read refuses it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { aiMessage } from '../../../packages/story-block/testkit/fake-st.js';
import { readRecord } from '../../../core/persist.js';
import { GO, IA_KIND, activeSettles, box, codes, iaApi, iaModule, withLines } from '../../../packages/story-block/tests/v2/qa/helpers/probe-interaction.js';

// Stage and Send, build the reply's prompt (the interceptor), and leave the reply in flight.
async function inFlight(host, api) {
    await host.send('Hello.', withLines('A.', ['! ia lamp1']));
    const id = api.open(IA_KIND).id;
    api.stage(id, GO);
    host.st.addUser('I go.');
    await host.st.generate('normal', { reply: '' });
    api.send(id);
    let aborted = false;
    await host.turn.interceptor(host.ctx.chat, 8000, () => { aborted = true; }, 'regenerate');
    assert.equal(aborted, false, 'the prompt was built');
    host.aborted = () => aborted;   // (whether the turn stopped the reply since)
    return id;
}
const deliver = async (host, text) => host.turn.onMessageReceived(host.st.addMessage(aiMessage(text)));
const setLamp = (host, value) => host.bus.command('ia.set', { key: 'lamp', value }, { cause: 'system' });

test('a reader edit that changes what the reply read is refused while the reply is in flight', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        await inFlight(host, iaApi(host));
        const edit = await host.sdk.command('ia.set', { key: 'lamp', value: 2 });
        assert.equal(edit.ok, false);
        assert.match(edit.message, /Wait for the reply to finish/);
        assert.equal(host.head().domains.ia.lamp, 1);
    } finally { host.close(); }
});

test('what the reply read changing anyway stops the reply, with a Problem', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        await inFlight(host, iaApi(host));
        assert.equal(host.aborted(), false);
        await setLamp(host, 2);
        host.events.emit('committed', { receipt: null });
        assert.equal(codes(host).includes('INTERACTION_CHANGED'), true);
        assert.equal(host.aborted(), true, 'the generation was stopped through the interceptor\'s abort handle');
    } finally { host.close(); }
});

test('a reply that arrives after its input changed is held, marked in the metadata, refused a Re-read, and finishes once restored', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await inFlight(host, api);
        await setLamp(host, 2);
        assert.equal(await deliver(host, 'He goes.'), null, 'the reply was not captured');
        const index = host.ctx.chat.length - 1, sid = host.store.carrierSid(index);
        assert.deepEqual(Object.keys(box(host).held), [sid]);
        assert.equal(host.turn.session() !== null, true, 'the capture session is kept for the resume');
        assert.equal(activeSettles(host).length, 0);
        const again = await host.turn.reread(index);
        assert.equal(again.ok, false);
        assert.match(again.message, /Restore what the interaction used/);
        // Restored: the reply finishes by itself.
        await setLamp(host, 1);
        host.events.emit('head', { index: host.store.headIndex() });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(activeSettles(host).length, 1, 'the settle is stored on the held reply now');
        assert.equal(activeSettles(host)[0].index, index);
        assert.equal(readRecord(host.ctx.chat[index]).receipts.some(receipt => receipt.type === 'interaction.settle'), true);
    } finally { host.close(); }
});

test('a held reply is found again after a reload, and a discard keeps it from resuming', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host), id = await inFlight(host, api);
        await setLamp(host, 2);
        await deliver(host, 'He goes.');
        await host.turn.onChatChanged();
        assert.equal(codes(host).includes('INTERACTION_HELD'), true, 'the hold is restored with a Problem');
        assert.equal(api.discard(id).ok, true);
        assert.deepEqual(Object.values(box(host).heldDiscarded), [true]);
        await setLamp(host, 1);
        host.events.emit('head', { index: host.store.headIndex() });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(activeSettles(host).length, 0, 'a discarded interaction is not resumed');
    } finally { host.close(); }
});
