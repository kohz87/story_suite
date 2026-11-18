// HK-2: with `keepRecentBlocks` on, a `+` line of a reply's own block identical (op, kind, name) to one in the two kept blocks is dropped
// unless the reply's story shows it happening again; replay == live (swipe, edited Re-read, reload); off, nothing is dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { said } from './keep-blocks.helpers.js';

const ropes = host => Object.values(host.head().domains.inventory.stacks).filter(item => item.def === 'story/rope').reduce((sum, item) => sum + item.qty, 0);
const host = keep => createHost({ settings: { core: { keepRecentBlocks: keep } } });

test('a + line copied from a kept block is dropped; a new one, and one the story shows again, stay', async () => {
    const h = await host(true);
    try {
        await h.send('Look.', said('You find a rope.', ['+ item Rope']));
        await h.send('Go.', said('You go on.', ['+ item Rope', '+ item Lamp']));
        assert.equal(ropes(h), 1, 'the copied rope is not applied again');
        assert.ok(Object.values(h.head().domains.inventory.stacks).some(item => item.def === 'story/lamp'), 'a new line stays');
        await h.send('Again.', said('You tie a second rope to the post.', ['+ item Rope']));
        assert.equal(ropes(h), 2, 'the story shows a rope again: applied');
    } finally { h.close(); }
});

test('a line older than the two kept blocks is not an echo; off, nothing is dropped', async () => {
    const h = await host(true);
    try {
        await h.send('1.', said('One.', ['+ item Rope']));
        await h.send('2.', said('Two.', ['+ item Lamp']));
        await h.send('3.', said('Three.', ['+ item Map']));
        await h.send('4.', said('Four.', ['+ item Rope']));
        assert.equal(ropes(h), 2);
    } finally { h.close(); }
    const off = await host(false);
    try {
        await off.send('1.', said('One.', ['+ item Rope']));
        await off.send('2.', said('Two.', ['+ item Rope']));
        assert.equal(ropes(off), 2);
    } finally { off.close(); }
});

test('replay == live: a swipe, then an edited Re-read, judge the copy the same way', async () => {
    const h = await host(true);
    try {
        await h.send('Look.', said('You find a rope.', ['+ item Rope']));
        await h.send('Go.', said('You go on.', ['+ item Rope']));
        const at = h.ctx.chat.length - 1;
        const live = JSON.stringify(h.head());
        await h.turn.reread(at);
        assert.equal(JSON.stringify(h.head()), live, 'a Re-read of the same text changes nothing');
        await h.swipe(said('You wander.', ['+ item Rope']));
        assert.equal(ropes(h), 1, 'the swiped reply copies it too');
        await h.st.editMessage(at, said('You tie a spare rope.', ['+ item Rope']));
        await h.turn.reread(at);
        assert.equal(ropes(h), 2, 'an edit that shows the rope applies it');
        await h.st.editMessage(at, said('You go on.', ['+ item Rope']));
        await h.turn.reread(at);
        assert.equal(ropes(h), 1, 'and an edit back drops it again');
    } finally { h.close(); }
});
