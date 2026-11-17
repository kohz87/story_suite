// B1.7: `- key Name | died` is no longer taught, but a reply that carries it replays exactly as it was recorded live.
// Swipe and swipe back, an edited Re-read (grown and shrunk), a middle delete, a rebuild and a reload give the live state; the Director
// without NPC State has nothing else to ask: a pinned person then leaves by Unpin (or an old death line) only.
import test from 'node:test';
import assert from 'node:assert/strict';

import { OPENING, keyHost, pin, said, slice, sent, STATIC_KEY } from './helpers.js';

const last = host => host.ctx.chat.length - 1;
const gone = host => Object.keys(slice(host).gone).sort();
const state = host => JSON.stringify(host.head().domains.keypeople);

async function start() {
    const host = await keyHost();
    await host.send('Hello.', said('Dawn.', OPENING));
    return host;
}

test('an old `- key` reply replays: a swipe takes it back, swiping back restores it, a rebuild and a reload agree', async () => {
    const host = await start();
    try {
        await host.send('He falls.', said('Vorn dies.', ['- key Vorn | died']));
        const at = last(host);
        const live = state(host);
        assert.deepEqual(gone(host), ['vorn']);
        await host.swipe(said('Vorn lives.', []));
        assert.deepEqual(gone(host), [], 'the new swipe has no death');
        await host.st.swipeTo(at, 0);
        assert.deepEqual(gone(host), ['vorn']);
        assert.equal(state(host), live, 'swipe back is the live state');
        host.store.rebuild();
        assert.equal(state(host), live, 'a rebuild');
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(state(host), live, 'a reload');
    } finally { host.close(); }
});

test('an edited Re-read: the death line grown (a second death) and shrunk (none) both follow the text', async () => {
    const host = await start();
    try {
        await host.send('He falls.', said('Vorn dies.', ['- key Vorn | died']));
        const at = last(host);
        await host.st.editMessage(at, said('Both die.', ['- key Vorn | died', '- key Ann | died']));
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.deepEqual(gone(host), ['ann', 'vorn'], 'grown');
        await host.st.editMessage(at, said('Nobody dies.', []));
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.deepEqual(gone(host), [], 'shrunk');
        host.store.rebuild();
        assert.deepEqual(gone(host), []);
    } finally { host.close(); }
});

test('a middle delete and a rewind: the death goes with its reply, the later ones stay', async () => {
    const host = await start();
    try {
        await host.send('One.', said('Vorn dies.', ['- key Vorn | died']));
        const first = last(host);
        await host.send('Two.', said('Ann dies.', ['- key Ann | died']));
        assert.deepEqual(gone(host), ['ann', 'vorn']);
        await host.st.deleteMessage(first);
        await host.st.deleteMessage(first - 1);
        assert.deepEqual(gone(host), ['ann'], 'a middle delete');
        const live = state(host);
        host.store.rebuild();
        assert.equal(state(host), live, 'rebuild == live');
        await host.st.deleteMessage(last(host));
        await host.st.deleteMessage(last(host));
        assert.deepEqual(gone(host), [], 'a rewind past it');
    } finally { host.close(); }
});

test('the key head is the replay: a pinned person leaves from the old line, though nothing teaches it', async () => {
    const host = await start();
    try {
        await pin(host, 'Mara');
        await host.send('Go.', said('Mara falls.', ['- key Mara | died']));
        assert.deepEqual(slice(host).pins, {}, 'a pinned person leaves with the reason');
        assert.equal(slice(host).gone.mara.reason, 'died');
        for (const text of sent(host, STATIC_KEY)) assert.equal(text.includes('- key Name'), false, 'never taught');
    } finally { host.close(); }
});
