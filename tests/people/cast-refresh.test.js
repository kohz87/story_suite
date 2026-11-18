import test from 'node:test';
import assert from 'node:assert/strict';
import { createCastRefreshPart } from '../../modules/people/legacy/runtime-cast-refresh.js';

// B4-6: nothing is drawn in the chat; the part only tells the Cast and World panes (cast-rendered) that the dossiers may have changed.

function withDocument(run) {
    const saved = globalThis.document;
    const events = [];
    globalThis.document = { dispatchEvent: event => { events.push([event.type, event.detail]); return true; } };
    return Promise.resolve(run(events)).finally(() => { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a refresh asked several times in a row tells the panes once, never marked as streaming', () => withDocument(async events => {
    const part = createCastRefreshPart({ chatHydrationStatus: () => 'ready', getChatKey: () => 'chat-1' });
    part.queueCastRefresh(5);
    part.queueCastRefresh(5);
    part.queueCastRefresh(5);
    await wait(60);
    assert.deepEqual(events, [['npc-state-delta:cast-rendered', { streaming: false }]]);
}));

test('no chat, or a chat whose dossiers are not loaded, tells nobody', () => withDocument(async events => {
    const none = createCastRefreshPart({ chatHydrationStatus: () => 'ready', getChatKey: () => 'no-chat' });
    none.queueCastRefresh(0);
    const loading = createCastRefreshPart({ chatHydrationStatus: () => 'loading', getChatKey: () => 'chat-1' });
    loading.queueCastRefresh(0);
    const broken = createCastRefreshPart({ chatHydrationStatus: () => 'ready', getChatKey: () => { throw new Error('no context'); } });
    broken.queueCastRefresh(0);
    await wait(40);
    assert.deepEqual(events, []);
}));

test('the retired in-chat entries are not exported by the part, and nothing mounts under a reply', async () => {
    const part = createCastRefreshPart({ chatHydrationStatus: () => 'ready', getChatKey: () => 'chat-1' });
    assert.deepEqual(Object.keys(part).sort(), ['announceCastRendered', 'queueCastRefresh']);
});
