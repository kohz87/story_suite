// An offer gets an opening only when it asks for one (a known-foe offer has none), and the waiting choice's record is the core's: a cleared choice takes an otherwise empty box with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startInteraction } from '../../../core/interaction/start.js';
import { clearStart, holdStart, pendingStart } from '../../../core/interaction/start-hold.js';
import { hashText } from '../../../modules/assist/common.js';
import { createHost } from '../../../testkit/index.js';

const KIND = 'test/with-opening';
const reader = 'I attack.';
// A real chat: one reply with a record, then the reader's message waiting.
async function chatOf() {
    const host = await createHost();
    await host.send('Begin.', 'Opening.');
    host.ctx.chat.push({ is_user: true, name: 'You', mes: reader, extra: {} });
    return { chat: host.ctx.chat, anchor: host.store.carrierSid(host.store.headIndex()), close: () => host.close() };
}

async function run(offer) {
    const kind = { title: 'Test', version: 1, open: () => ({ setup: { x: 1 } }), opening: () => ({ result: {}, changes: [] }) };
    const { chat, anchor, close } = await chatOf(), meta = {}, runs = [];
    const bus = { run: (type, payload) => { runs.push(payload); return { ok: true, receipt: { data: { v2: { result: { opened: [] } } } }, state: {} }; } };
    try {
        const out = startInteraction({ answer: { interactionStart: { kindId: KIND, title: 'Test', anchor, message: hashText(reader), choices: ['board'], ...offer } }, moduleId: 'm', chat, metadata: () => meta, bus,
            kindOf: () => kind, problem: () => {}, state: {}, allowed: [KIND] });
        return { out, meta, runs };
    } finally { close(); }
}

test('an offer with no opening is held with no opening settle, even though its kind has an opening; one that asks gets it previewed and recorded', async () => {
    const plain = await run({});
    assert.ok(plain.out.blocked, 'the send is held');
    assert.equal(plain.runs.length, 0, 'no opening was settled');
    assert.equal(plain.meta.storySuiteInteraction.start.opening, undefined);
    const asked = await run({ opening: { args: {} } });
    assert.ok(asked.out.blocked);
    assert.equal(asked.runs.length, 1, 'the opening was previewed once');
    assert.equal(asked.runs[0].opening, true);
    assert.ok(asked.meta.storySuiteInteraction.start.opening, 'and recorded with the hold');
});

test('clearing the waiting choice removes a box that held only it, and keeps one that holds anything else', async () => {
    const { chat, anchor, close } = await chatOf(), meta = {};
    assert.ok(holdStart(meta, chat, { kindId: KIND, title: 'Test', mode: 'known' }));
    assert.ok(pendingStart(meta, chat));
    clearStart(meta);
    assert.equal(Object.hasOwn(meta, 'storySuiteInteraction'), false, 'a chat that never played an interaction keeps the metadata it had');
    const kept = { storySuiteInteraction: { attempts: { 'anchor-1': 1 } } };
    assert.ok(anchor);
    assert.ok(holdStart(kept, chat, { kindId: KIND, title: 'Test', mode: 'known' }));
    clearStart(kept);
    assert.deepEqual(kept.storySuiteInteraction, { attempts: { 'anchor-1': 1 } });
    close();
});
