// §2.2 "middle delete under a carried segment" and §2.3: segment 2's setup was made from segment 1's result, and its payload records `prior`; when
// segment 1 comes out again with another result, segment 2 is taken back, and the open session is made again from the new result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { activeSettles, box, codes, iaApi, iaChain, iaModule, playSegment, setText, withLines, GO } from '../../suite/qa/helpers/probe-interaction.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

test('a carried segment records the result it came from, and the next segment opens on it', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await iaChain(host, api, { segments: 3 });
        const [one, two, three] = activeSettles(host);
        assert.equal(two.payload.carriedKey, one.payload.key);
        assert.equal(three.payload.carriedKey, two.payload.key);
        assert.equal(two.payload.offset, 1);
        assert.equal(three.payload.offset, 2);
        assert.equal(two.payload.setup.from, one.result.total, 'segment 2 was opened from result 1 (the kind\'s next)');
        assert.equal(box(host).open.offset, 3);
    } finally { host.close(); }
});

test('a middle delete that changes result 1 takes segment 2 back, and the session is opened again from the new result', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        // A, then B (sets luck 2, a number the settle reads but its witness does not cover), then two segments.
        await host.send('Hello.', reply('A.', ['! ia lamp1']));
        await host.send('Next.', reply('B.', ['! ia luck2']));
        await playSegment(host, api, GO, 'go0', 'S1.');
        await playSegment(host, api, GO, 'go1', 'S2.');
        const [one, two] = activeSettles(host);
        assert.equal(one.result.luck, 2);
        await host.st.deleteMessage(4);   // B: luck 2 → 0; segment 1 is planned again and rolls another total
        const now = activeSettles(host);
        assert.equal(now.length, 1, 'only segment 1 is left');
        assert.equal(now[0].payload.key, one.payload.key);
        assert.equal(now[0].result.luck, 0);
        assert.notEqual(now[0].result.total, one.result.total);
        assert.equal(codes(host).filter(code => code === 'INTERACTION_TAKEN_BACK').length, 1);
        assert.match(host.turn.problems().find(item => item.code === 'INTERACTION_TAKEN_BACK').message, /earlier part of the Probe changed/);
        const open = box(host).open;
        assert.equal(open.offset, 1);
        assert.equal(open.setup.from, now[0].result.total, 'segment 2 opens on result 1 as it is now');
        assert.equal(two.payload.setup.from, one.result.total);
    } finally { host.close(); }
});

test('a session made again from a changed result keeps its base chain, so later deletes still step back one segment at a time', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await host.send('Hello.', reply('A.', ['! ia lamp1']));
        await playSegment(host, api, GO, 'go0', 'S1.', { lines: ['! ia luck2'] });
        await playSegment(host, api, GO, 'go1', 'S2.');
        const live = structuredClone(box(host).open.base);
        // Segment 1's own lines change (luck 2 is gone), so segment 2 comes out again with another total and the session is made again.
        setText(host, 4, withLines('S1.', []));
        assert.equal((await host.turn.reread(4)).ok, true);
        assert.equal(activeSettles(host).length, 2);
        assert.deepEqual(box(host).open.base, live, 'the base (its own carry fields included) is what it was');
        await host.st.deleteMessage(6); await host.st.deleteMessage(5);   // segment 2 and its message
        assert.equal(box(host).open.offset, 1, 'one step back: segment 2 again');
        await host.st.deleteMessage(4); await host.st.deleteMessage(3);   // segment 1 and its message
        assert.equal(box(host).open.offset, 0, 'and another: segment 1 again, still open');
        assert.equal(box(host).open.anchor, host.store.carrierSid(2));
    } finally { host.close(); }
});

test('a staged session taken back on its own anchor is held with the take-back reason, not "Play the waiting"', async () => {
    const host = await createHost({ modules: [iaModule()] });
    try {
        const api = iaApi(host);
        await host.send('Hello.', reply('A.', ['! ia lamp1']));
        await host.send('Next.', reply('B.', ['! ia luck2']));
        await playSegment(host, api, GO, 'go0', 'S1.');
        assert.equal(api.stage(box(host).open.id, GO).ok, true, 'a step is staged on segment 2');
        setText(host, 4, withLines('B.', []));   // luck 2 is gone: segment 1 plans again with another total
        await host.turn.reread(4);
        assert.equal(box(host).open.invalidated, true);
        host.st.addUser('I go.');
        const held = await host.st.generate('normal', { reply: '' });
        assert.equal(held.aborted, true);
        const reason = host.turn.blocked().at(-1).reason;
        assert.match(reason, /^The earlier Probe was taken back\. Restore that reply or discard\.$/);
        assert.doesNotMatch(reason, /Play the waiting/);
    } finally { host.close(); }
});
