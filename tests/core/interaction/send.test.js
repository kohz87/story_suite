// A send copy is the exact staged payload, readable only beside the matching waiting message.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashText } from '../../../packages/story-block/src/v2/assist/common.js';
import { linkMessage, markSend, priorPayload, readSend } from '../../../core/interaction/send.js';
import { interactionPayload } from '../../../core/interaction/session.js';

const session = {
    v: 1, id: 'reply-1:0:test/probe', kindId: 'test/probe', version: 1, origin: 'reply-1', anchor: 'reply-1', attempt: 0,
    seed: 7, offset: 0, setup: { room: 1 }, steps: [{ inputs: [{ actor: 'hero', choice: 'go' }] }],
    witness: { offset: 0, hash: 'a'.repeat(64) }, player: 'hero', policy: { choosers: 'own', party: false },
};
const anchorMessage = {
    is_user: false,
    extra: { storySuite: { v: 2, ops: [], receipts: [], narrated: [], sid: 'reply-1' } },
};

test('markSend copies the payload byte for byte and readSend checks the message and anchor', () => {
    const meta = {}, pending = { anchor: 'reply-1', message: hashText('Go north.') };
    assert.equal(markSend(meta, pending, session), true);
    assert.deepEqual(meta.send.payload, interactionPayload(session));
    const chat = [anchorMessage, { is_user: true, mes: '  Go north.  ' }];
    assert.deepEqual(readSend(meta, chat), meta.send);
    assert.equal(readSend(meta, [anchorMessage, { is_user: true, mes: 'Go south.' }]), null);
    assert.equal(readSend(meta, [{ ...anchorMessage, extra: { storySuite: { ...anchorMessage.extra.storySuite, sid: 'other' } } },
        { is_user: true, mes: 'Go north.' }]), null);
});

test('links are add-only and priorPayload reads the reply\'s own interaction receipt', () => {
    const message = { extra: {} };
    assert.equal(linkMessage(message, 'i:key'), true);
    assert.equal(linkMessage(message, 'i:key'), true);
    assert.deepEqual(message.extra.storySuiteInteractionLinks, { 'i:key': true });
    const payload = { v: 1, kindId: 'test/probe', key: 'i:key', steps: [] };
    const reply = { extra: { storySuite: { receipts: [
        { type: 'rpg.resolve', replan: { payload: { board: {} } } },
        { type: 'interaction.settle', replan: { payload } },
    ] } } };
    assert.deepEqual(priorPayload(reply), payload);
    assert.notEqual(priorPayload(reply), payload);
});
