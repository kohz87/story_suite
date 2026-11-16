// Delta follows the host's selected head. A delete, a swipe or a retraction moves the head; Story Block's barrier goes up, asks the participant to
// stand on the checkpoint of the selected head (its prepare and activate), and comes down when it does (docs/v2/HISTORY.md). Delta does not select
// anything itself: it answers the host's callbacks, and it reads, scans and generates only once the barrier is down, on the selected checkpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterRig, BATCH, clone, crash, rig } from './helpers/participant-rig.js';
import { runHostScenario } from './helpers/host-scenario.js';
import { fileVault, memoryVault } from '../src/storysuite-participant/vault.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

/** Three replies, each with a native change published at it (trust 5, 7, 9), after a first save point that starts the timeline for the chat. */
async function story(t, options) {
    const r = await adapterRig(t, options);
    const { host } = r;
    await host.send('Hello.', 'One.');
    const point = (await host.sdk.timeline.make({ kind: 'manual', name: 'Start' })).snapshot;
    await r.published(state => { state.npcs[0].trust = 5; });
    await host.send('Two.', 'Two reply.');
    await r.published(state => { state.npcs[0].trust = 7; });
    await host.send('Three.', 'Three reply.');
    await r.published(state => { state.npcs[0].trust = 9; });
    return { ...r, point };
}
const trust = r => r.live.state.npcs[0].trust;
/** Deletes the newest reply, and the reader's messages after it. */
async function dropReply(r) {
    const chat = r.host.ctx.chat;
    while (chat.length && chat.at(-1).is_user) await r.host.st.deleteMessage(chat.length - 1);
    await r.host.st.deleteMessage(chat.length - 1);
}
const standing = async r => (await r.host.sdk.timeline.status()).participants[0];
/** Delta stands on the checkpoint the host selected for the head. */
async function followed(r, expected) {
    assert.equal(await r.api.gate.settled(), true, 'the barrier is down');
    assert.equal(r.host.registry.restore().state, 'idle');
    assert.equal(trust(r), expected);
    const selected = await standing(r);
    assert.equal(selected.checkpoint, r.delta?.index?.().base.checkpoint ?? selected.checkpoint);
    assert.deepEqual(r.host.store.problems(), []);
}

test('a completed restore is not skipped during recovery: the participant says it switched only while its live state is the restore\'s bytes', async t => {
    const r = await rig(t);
    await r.host.send('Hello.', 'One.');
    const point = (await r.host.sdk.timeline.make({ kind: 'manual', name: 'Start' })).snapshot;
    await r.change(state => { state.npcs[0].trust = 5; });
    await r.host.send('Two.', 'Two reply.');
    await r.change(state => { state.npcs[0].trust = 9; });
    const dead = clone(r.live.state);
    // The process dies with the restore committed in the story and the participant not yet asked to switch.
    let image = null;
    r.hook.at = async phase => { if (phase === 'activate.participant:npc-state-delta:before') { image = clone(r.disk.image); throw crash(); } };
    await assert.rejects(r.restoreTo(point), error => /simulated crash/.test(error.message));
    assert.notEqual(image, null);
    // The recovery switches Delta (its index now says the restore is active) ...
    const first = await rig(t, { vault: r.vault, image, live: r.live, hydrate: false });
    assert.equal(first.live.state.npcs[0].trust, 3);
    assert.equal(first.host.registry.restore().state, 'idle');
    // ... and the same journal found again over a state file that never got that install is not skipped on the strength of the index.
    const stale = { chatKey: r.live.chatKey, state: clone(dead), installs: 0 };
    const second = await rig(t, { vault: r.vault, image, live: stale, hydrate: false });
    assert.equal(stale.state.npcs[0].trust, 3, 'installed again, not acknowledged on the old word');
    assert.equal(stale.installs, 1);
    assert.equal(second.host.registry.restore().state, 'idle');
    assert.deepEqual(second.host.store.problems(), []);
    // And once it stands on the restore, the word is "active" again and nothing more is installed.
    const third = await rig(t, { vault: r.vault, image, live: stale, hydrate: false });
    assert.equal(stale.installs, 1);
    second.host.store.rebuild();
    await second.host.timeline.host.recover();
    assert.equal(stale.state.npcs[0].trust, 3);
    void third;
});

// ---- checkpoint files across a long story: the file vault (packed files) and the plain memory vault end every step on the same state ------

/** A fake SillyTavern user-files server (upload / verify / delete / read) for the file vault. */
function filesServer() {
    const files = new Map();
    const fetchFn = async (url, options = {}) => {
        const name = url.split('/').pop();
        if (url === '/api/files/upload') { const body = JSON.parse(options.body); files.set(body.name, Buffer.from(body.data, 'base64').toString()); return { ok: true, status: 200 }; }
        if (url === '/api/files/verify') { const body = JSON.parse(options.body); return { ok: true, status: 200, json: async () => Object.fromEntries(body.urls.map(u => [u, files.has(u.split('/').pop())])) }; }
        if (url === '/api/files/delete') { const had = files.delete(JSON.parse(options.body).path.split('/').pop()); return { ok: had, status: had ? 200 : 404, text: async () => '' }; }
        return files.has(name) ? { ok: true, status: 200, text: async () => files.get(name) } : { ok: false, status: 404, text: async () => '' };
    };
    return { files, fetchFn };
}

const REPLIES = Number(process.env.CKPT_REPLIES) || 60;
/** One long play: REPLIES replies with three published changes each (Delta's own history grows with every one), then a delete, a swipe and back, a restore to the first save point and a reload. */
async function longStory(t, vault) {
    const r = await adapterRig(t, { vault });
    const { host } = r;
    const edit = (n, k) => state => {
        const npc = state.npcs[0];
        npc.trust = (n * 3 + k) % 10;
        npc.memories = [...(npc.memories ?? []), `memory ${n}.${k}`];
        state.checkpoints = [...(state.checkpoints ?? []), { messageId: n, fingerprint: `fp${n}.${k}`, lineageKey: `L${n}.${k}`, snapshot: { turn: n, npcs: structuredClone(state.npcs) } }];
    };
    const seen = [];
    const mark = label => { const { timeline, ...rest } = r.live.state; seen.push([label, JSON.stringify(rest)]); };
    await host.send('Hello.', 'One.');
    const point = (await host.sdk.timeline.make({ kind: 'manual', name: 'Start' })).snapshot;
    for (let n = 1; n <= REPLIES; n += 1) {
        if (n > 1) await host.send(`Turn ${n}.`, `Reply ${n}.`);
        for (let k = 0; k < 3; k += 1) await r.published(edit(n, k));
        if (n % 10 === 0) mark(`reply ${n}`);
    }
    await dropReply(r);
    await followed(r, (REPLIES * 3 - 1) % 10);
    mark('after delete');
    await host.send('Again.', 'Again reply.');
    await r.published(edit(REPLIES + 1, 0));
    await host.swipe('Another.');
    await followed(r, (REPLIES * 3 - 1) % 10);
    mark('after swipe');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    await followed(r, ((REPLIES + 1) * 3) % 10);
    mark('after swipe back');
    assert.equal((await host.sdk.command('tl.seal', { id: BATCH.id })).ok, true);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: point.id, deathEvents: ['ev_death001'], batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).status, 'complete');
    mark('after restore to the first save point');
    const again = await r.reload();
    assert.equal(await again.api.gate.settled(), true);
    assert.equal(again.live.state.npcs[0].trust, 3, 'the reload stands on the first save point');
    mark('after reload');
    return seen;
}
