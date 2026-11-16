// Replay == live for the settled note (I5): the note the narrator is told is the stored receipt's summary and nothing else, so a swipe, a swipe back,
// an edited Re-read (grown and shrunk), a middle delete, a rewind, a reload and a chat change leave the same summary, and it is told once, with its own reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { activeSettles, iaApi, iaChain, iaKind, iaModule, setText, withLines } from '../qa/helpers/probe-interaction.js';

const NOTE = '[Happened]\\nProbe round 0: go';   // as it sits in a request's JSON
const told = host => JSON.stringify(host.st.requests.at(-1)).split(NOTE).length - 1;
const summaries = host => host.store.receipts().filter(entry => entry.receipt.type === 'interaction.settle').map(entry => entry.receipt.summary);

async function chain() {
    const host = await createHost({ modules: [iaModule()] });
    const api = iaApi(host), { s } = await iaChain(host, api, { segments: 1 });
    return { host, api, s, live: summaries(host) };
}

test('the note is told once with its own reply, and not again by the reply after it', async () => {
    const { host, s, live } = await chain();
    try {
        assert.equal(told(host), 1, 'the settle reply\'s own request');
        assert.equal(live.length, 1);
        assert.match(live[0], /^Probe round 0: go/);
        await host.send('Next.', 'Plain.');
        assert.equal(told(host), 0, 'told once');
        assert.deepEqual(summaries(host), live);
        assert.ok(s[0] > 0);
    } finally { host.close(); }
});

test('a swipe is told the same note once; swiping back and a next reply keep it and tell it no more', async () => {
    const { host, s, live } = await chain();
    try {
        await host.swipe('S1, another way.');
        assert.equal(told(host), 1, 'the swipe\'s request');
        assert.deepEqual(summaries(host), live);
        await host.st.swipeTo(s[0], 0);
        assert.deepEqual(summaries(host), live, 'swiped back');
        await host.send('Next.', 'Plain.');
        assert.equal(told(host), 0);
    } finally { host.close(); }
});

test('an edited Re-read, grown and shrunk, and a middle delete keep the same note and tell it no more', async () => {
    const { host, s, live } = await chain();
    try {
        await host.send('Two.', 'Plain two.');
        await host.send('Three.', 'Plain three.');
        setText(host, s[0], withLines('S1, with more words.', ['! ia luck1']));
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(summaries(host), live, 'grown');
        setText(host, s[0], 'S1.');
        assert.equal((await host.turn.reread(s[0])).ok, true);
        assert.deepEqual(summaries(host), live, 'shrunk');
        assert.equal(host.store.untold().filter(receipt => receipt.type === 'interaction.settle').length, 0, 'nothing is left to tell again');
        await host.st.deleteMessage(s[0] + 2);
        await host.st.deleteMessage(s[0] + 1);
        assert.deepEqual(summaries(host), live, 'a middle delete');
        await host.send('Four.', 'Plain four.');
        assert.equal(told(host), 0);
    } finally { host.close(); }
});

test('a reload and a chat change keep the same note and tell it no more', async () => {
    const { host, live } = await chain();
    try {
        await host.turn.onChatChanged();
        assert.deepEqual(summaries(host), live, 'reload');
        await host.st.loadChat(host.st.saved() ?? host.ctx.chat);
        assert.deepEqual(summaries(host), live, 'chat change');
        await host.send('Next.', 'Plain.');
        assert.equal(told(host), 0);
        assert.equal(activeSettles(host).length, 1);
    } finally { host.close(); }
});

test('a rewind to before the settle takes the note off the line with it', async () => {
    const { host } = await chain();
    try {
        const entry = host.store.receipts().find(item => item.receipt.type === 'interaction.settle');
        assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
        assert.deepEqual(summaries(host), []);
        await host.send('Next.', 'Plain.');
        assert.equal(told(host), 0, 'a note that is off the line is not told');
    } finally { host.close(); }
});

test('an over-long note is named once however often the prompt is built, and is still told whole', async () => {
    const host = await createHost({ modules: [iaModule({ kind: iaKind({ limits: { steps: 4, stepInputs: 2, noteTokens: 3 } }) })] });
    try {
        const { s } = await iaChain(host, iaApi(host), { segments: 1 });
        assert.equal(told(host), 1, 'sent whole');
        await host.swipe('S1, another way.');
        await host.swipe('S1, a third way.');
        assert.equal(told(host), 1);
        assert.equal(host.turn.problems().filter(item => item.code === 'NOTE_LONG').length, 1);
        assert.ok(s[0] > 0);
    } finally { host.close(); }
});
