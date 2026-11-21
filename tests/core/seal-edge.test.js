// Sealed history at the edge, on the real host (testkit createHost, host setting sealHistory on, window 4, step 2): the seal comes by itself
// at a quiet moment after a reply and is saved; a sealed reply deleted or edited keeps its changes and the reader is told; Re-read and Return
// in time past the edge are refused; the Tools card says where the edge is, and the switch stops new seals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { SEAL_WAIT_MS } from '../../core/turn/seal-idle.js';
import { selectHistory } from '../../ui/select/history.js';
import { toolsCommand } from '../../ui/port/tools.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const line = n => `The road goes on.\n<Changes>\n+ item Stone ${n} | qty: 1\n</Changes>`;

async function grown(t, replies, { on = true } = {}) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const host = await createHost({ settings: { core: { sealHistory: on } }, storeOptions: { sealing: { window: 4, step: 2 }, checkpointEvery: 3 } });
    t.after(() => host.close());
    for (let n = 0; n < replies; n++) {
        await host.send(`Step ${n}.`, line(n));
        for (let k = 0; k < 4; k++) { t.mock.timers.tick(SEAL_WAIT_MS); await settle(); }
    }
    return host;
}
const sealedCount = host => host.ctx.chat.filter(message => message?.extra?.storySuite?.sealed === 1).length;

test('the seal comes by itself at a quiet moment after a reply, is saved, and keeps the head', async t => {
    const host = await grown(t, 7);
    assert.equal(sealedCount(host), 4, 'eight carriers: four sealed, four whole');
    assert.equal(host.store.dirty(), false, 'the seal was saved');
    assert.deepEqual(host.st.saved().at(-1)?.extra?.storySuite?.v, 2);
    assert.equal(host.store.history().status, 'ok');
    const stones = Object.keys(host.head().domains.inventory.defs ?? host.head().domains.inventory.stacks ?? {}).length;
    assert.ok(stones >= 7, 'every reply\'s item is still there');
});

test('with the switch off nothing is sealed; the Tools card says so and turns it on', async t => {
    const host = await grown(t, 7, { on: false });
    assert.equal(sealedCount(host), 0);
    const view = selectHistory({ on: false, ...host.store.history() });
    assert.equal(view.text, 'Tidying story history is off: every reply is kept step by step.');
    assert.equal(view.button, 'Turn on');
    const writes = { settings: { set: (module, key, value) => (module === null && key === 'sealHistory' ? value : undefined) } };
    assert.deepEqual(await toolsCommand(null, 'settings.action', { key: 'tools.history.on', value: true }, writes), { ok: true, value: true });
});

test('a sealed reply deleted keeps its changes and the reader is told once; an edit of one is told too', async t => {
    const host = await grown(t, 7);
    const head = JSON.stringify(host.head());
    await host.st.deleteMessage(2);      // the first reply's message (sealed)
    assert.equal(JSON.stringify(host.head()), head);
    assert.equal(host.st.notices.filter(n => /older than the last 4 replies, so its changes stay in the story\.$/.test(n.reason)).length, 1);
    const old = host.ctx.chat.findIndex(message => message?.extra?.storySuite?.sealed === 1 && !message.is_user && message !== host.ctx.chat[0]);
    await host.st.editMessage(old, 'An old reply, told another way.');
    assert.equal(JSON.stringify(host.head()), head);
    assert.ok(host.st.notices.some(n => /editing it changes only its text/.test(n.reason)));
});

test('Re-read and Return in time past the edge are refused before anything is done; inside the window they work', async t => {
    const host = await grown(t, 7);
    const from = host.store.history().from;
    const reread = await host.sdk.reread(from - 2);
    assert.equal(reread.ok, false);
    assert.equal(reread.code, 'SEALED');
    assert.match(reread.message, /can't be Re-read/);
    const rewind = await host.sdk.rewind({ index: from - 2, beforeRev: 1 });
    assert.equal(rewind.ok, false);
    assert.match(rewind.message, /Return in time reaches back 4 replies/);
    const view = selectHistory({ on: true, ...host.store.history() });
    assert.equal(view.text, `The last 4 replies are kept step by step (from message ${from}). Older replies keep their text and summaries; their changes can't be taken back.`);
});

test('a long chat from before sealing is sealed at its first quiet moment after it is opened', async t => {
    const host = await grown(t, 7, { on: false });
    assert.equal(sealedCount(host), 0);
    const head = JSON.stringify(host.head());
    host.ctx.extensionSettings.storySuite.core.sealHistory = true;
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)), host.ctx.chatId);
    for (let k = 0; k < 4; k++) { t.mock.timers.tick(SEAL_WAIT_MS); await settle(); }
    assert.equal(sealedCount(host), 4);
    assert.equal(JSON.stringify(host.head()), head);
});
