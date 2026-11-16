// §2.2a "the waiting choice": a module answers `interactionStart` before the reader's message goes out; the core previews the kind's opening, records the hold, and
// holds every send until the reader plays (Send). Until the scene host (I8) only the allowed kinds may ask: another kind's answer is dropped with a quiet Problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { hashText } from '../../../modules/assist/common.js';
import { readRecord } from '../../../core/persist.js';
import { START_KINDS } from '../../../core/interaction/start.js';
import { pendingStart } from '../../../core/interaction/start-hold.js';
import { GO, IA_KIND, activeSettles, box, codes, iaApi, iaKind, iaModule, withLines } from '../../suite/qa/helpers/probe-interaction.js';

// A module hook that offers the probe before a typed message goes out (what a rules module's beforeGenerate does with `interactionStart`).
function offering() {
    const state = { host: null, on: false };   // (switched on for the message that should be offered)
    const hooks = { beforeGenerate(view, info) {
        if (!state.on || info.type !== 'normal' || info.commit === false) return null;
        const chat = state.host.ctx.chat, last = chat.at(-1);
        return { interactionStart: { kindId: IA_KIND, title: 'Probe', anchor: readRecord(chat.at(-2))?.sid, message: hashText(String(last.mes ?? '').trim()), choices: ['play', 'auto'], opening: { args: {} } } };
    } };
    return { state, hooks };
}

test('an offer from a kind the old view cannot choose for is dropped with a quiet Problem, and the send goes on', async () => {
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;
        const out = await host.send('I go.', 'He goes.');
        assert.equal(out.aborted, undefined, 'the reply went out');
        assert.equal(host.ctx.chatMetadata.storySuiteInteraction, undefined, 'nothing was recorded');
        const dropped = host.turn.problems().find(item => item.code === 'INTERACTION_START');
        assert.equal(dropped.quiet, true);
    } finally { host.close(); }
});

test('an offer from an allowed kind previews its opening, holds the send, and is released by Send; the opening settles first with its own claim', async () => {
    START_KINDS.push(IA_KIND);
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;
        host.st.addUser('I go.');
        const reasons = [];
        host.events.on('head', event => reasons.push(event?.reason));
        const held = await host.st.generate('normal', { reply: '' });
        assert.equal(held.aborted, true);
        assert.equal(reasons.includes('interaction-start'), true, 'the screens are told to open the choice');
        const start = box(host).start;
        assert.equal(pendingStart(host.ctx.chatMetadata, host.ctx.chat), start);
        assert.equal(start.opening.payload.opening, true);
        const preview = host.turn.interactionStartPreview();
        assert.equal(preview.result.opened, start.result.opened, 'the opening is recreated from its saved seed');
        assert.equal(host.head().domains.ia.bag, 0, 'a preview writes nothing');
        offer.state.on = false;
        // Every attempt stays held until the reader plays.
        assert.equal((await host.st.generate('normal', { reply: '' })).aborted, true);
        const api = iaApi(host), id = api.open(IA_KIND).id;
        assert.equal(box(host).open.opening.payload.id, start.opening.payload.id, 'the session carries the opening');
        api.stage(id, GO);
        assert.equal((await host.st.generate('normal', { reply: '' })).aborted, true, 'staged but not sent: still held');
        assert.equal(api.send(id).ok, true);
        const done = await host.regenerate('He goes.');
        const settles = activeSettles(host);
        assert.deepEqual(settles.map(item => item.payload.opening === true), [true, false], 'the opening, then the segment');
        assert.notEqual(settles[0].payload.key, settles[1].payload.key);
        assert.equal(settles[0].index, done.index);
        assert.equal(box(host).start, undefined, 'the waiting choice is cleared once the reply is received');
        // A swipe settles both again from their stored payloads and seeds.
        await host.swipe('He goes, again.');
        assert.deepEqual(activeSettles(host).map(item => item.result), settles.map(item => item.result));
    } finally { START_KINDS.pop(); host.close(); }
});

test('a waiting choice is dropped when its message is gone, and discard clears it so the send goes out with no interaction', async () => {
    START_KINDS.push(IA_KIND);
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;
        host.st.addUser('I go.');
        await host.st.generate('normal', { reply: '' });
        const api = iaApi(host), id = api.open(IA_KIND).id;
        assert.equal(api.discard(id).ok, true);
        assert.equal(box(host).start, undefined, 'discard clears the waiting choice');
        offer.state.on = false;
        const out = await host.st.generate('normal', { reply: 'He goes.' });
        assert.equal(out.aborted, undefined, 'the send goes out');
        assert.equal(activeSettles(host).length, 0);
        // A fresh offer, then its message is deleted: the record is pruned.
        offer.state.on = true;
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        host.st.addUser('Another try.');
        await host.st.generate('normal', { reply: '' });
        assert.ok(box(host).start);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.turn.onChatChanged();
        assert.equal(pendingStart(host.ctx.chatMetadata, host.ctx.chat), null);
    } finally { START_KINDS.pop(); host.close(); }
});

// A kind whose opening changes what its own witness reads (a foe group the opening adds, a sheet the segment's witness covers).
const grounded = () => iaKind({
    witness: (state, setup) => ({ lamp: state.domains.ia.lamp, bag: state.domains.ia.bag, door: setup.door }),
    opening: (state, setup, dice) => ({ result: { opened: dice(5, 0, 6)() }, changes: [{ type: 'ia.grant', payload: { n: 1 } }] }),
});

test('an opening that changes what the witness reads: the segment is staged, checked and played on the state its opening leaves', async () => {
    START_KINDS.push(IA_KIND);
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ kind: grounded(), hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;
        host.st.addUser('I go.');
        assert.equal((await host.st.generate('normal', { reply: '' })).aborted, true);
        offer.state.on = false;
        const api = iaApi(host), id = api.open(IA_KIND).id;
        assert.equal(api.stage(id, GO).ok, true);
        assert.equal(api.send(id).ok, true);
        const done = await host.regenerate('He goes.');
        assert.equal(done.aborted, undefined, 'the reply went out: the witness held on the post-opening state');
        assert.deepEqual(activeSettles(host).map(item => item.payload.opening === true), [true, false]);
        assert.equal(host.head().domains.ia.bag, 1 + activeSettles(host)[1].result.total, 'the opening granted 1, then the segment');
        await host.swipe('He goes, again.');
        assert.equal(activeSettles(host).length, 2, 'a swipe settles both again');
        assert.equal(codes(host).includes('NO_LONGER_DONE'), false);
    } finally { START_KINDS.pop(); host.close(); }
});

test('a broken opening is a quiet Problem and the send goes on', async () => {
    START_KINDS.push(IA_KIND);
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ kind: iaKind({ open: () => { throw new Error('no door'); } }), hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;
        const out = await host.send('I go.', 'He goes.');
        assert.equal(out.aborted, undefined, 'the reply went out');
        const problem = host.turn.problems().find(item => item.code === 'INTERACTION_START');
        assert.equal(problem.quiet, true);
        assert.match(problem.message, /could not be prepared/);
    } finally { START_KINDS.pop(); host.close(); }
});

test('a module that keeps offering the choice on release does not hold the played send for ever (guards the busy check)', async () => {
    START_KINDS.push(IA_KIND);
    const offer = offering();
    const host = await createHost({ modules: [iaModule({ hooks: offer.hooks })] });
    try {
        offer.state.host = host;
        await host.send('Hello.', withLines('A.', ['! ia lamp1']));
        offer.state.on = true;   // stays on: the module asks again on every attempt
        host.st.addUser('I go.');
        assert.equal((await host.st.generate('normal', { reply: '' })).aborted, true);
        const api = iaApi(host), id = api.open(IA_KIND).id;
        api.stage(id, GO);
        assert.equal(api.send(id).ok, true);
        const done = await host.regenerate('He goes.');
        assert.equal(done.aborted, undefined, 'the played send went out');
        assert.equal(activeSettles(host).length, 2, 'the opening and the segment settled');
    } finally { START_KINDS.pop(); host.close(); }
});
