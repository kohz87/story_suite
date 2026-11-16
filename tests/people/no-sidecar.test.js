// P2: a chat opened by the merged extension writes no NPC State sidecar. The rig records every `/api/files/upload`; only portrait files may go up.
// The gate NPC State's persist part uses (`storeOwnsState`: the page flag the adapter sets while hosted, and the adapter hosted) must be true in this rig,
// so the check below is about a hosted chat. The behaviour of the gate itself (an upload with it off, none with it on) is proved in
// packages/npc-state-delta/tests/settings-debounce.test.js, which runs the real persist part against a file server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record, clone } from './helpers/people-rig.js';

const uploadName = options => { try { return String(JSON.parse(options?.body ?? '{}').name ?? ''); } catch { return ''; } };

// A small change of Delta's own (one person's trust moves by one): the next publication sends the whole view again.
const nudge = state => { state.npcs[0].trust = (Number(state.npcs[0].trust) || 0) + 1; };

test('no /api/files/upload of a state file while people are stored over a script of replies, a delete and a reload', async t => {
    const uploads = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => { if (String(url).includes('/api/files/upload')) uploads.push(uploadName(options)); return realFetch ? realFetch(url, options) : { ok: false, status: 404 }; };
    t.after(() => { globalThis.fetch = realFetch; });
    await globalThis.fetch('/api/files/upload', { method: 'POST', body: JSON.stringify({ name: 'control-state.json' }) }).catch(() => {});
    assert.deepEqual(uploads, ['control-state.json'], 'the spy sees an upload (control)');
    uploads.length = 0;
    const rig = await peopleRig(t);
    assert.equal(rig.doc.documentElement.dataset.npcStateDeltaStoryBlockV2, '1', 'the page flag that gates the sidecar is set');
    assert.equal(rig.adapter.hosted(), true, 'the adapter is hosted: both halves of the gate hold');
    for (let n = 1; n <= 6; n++) assert.equal(await rig.reply(`Turn ${n}.`, state => { state.turn = n + 1; state.npcs[0].trust = n; if (n === 3) state.npcs.push(record('vale')); }), true);
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    assert.equal(await rig.publish(nudge), true);
    const again = await rig.reload();
    assert.equal(await again.publish(nudge), true);
    assert.deepEqual(uploads.filter(name => !/portrait/i.test(name)), [], 'no state file was uploaded');
    assert.ok(rig.sends.length >= 6, 'the people reached the store each reply');
});

// The gap P2 left is closed by P3: with the sidecar off, a reload opens an empty NPC State memory and hydrates it from the store, so the next write keeps the people.
test('a reload hydrates NPC State from the store and the next reply keeps the people', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 3; n++) assert.equal(await rig.reply(`Turn ${n}.`, state => { state.npcs[0].trust = n; }), true);
    assert.deepEqual(Object.keys(rig.host.head().domains.people.npcs), ['npc_mira', 'npc_tom']);
    const live = { chatKey: rig.live.chatKey, state: { npcs: [], candidates: [], socialGraph: { edges: [] }, checkpoints: [], lineage: [], turn: 0 } };
    const again = await peopleRig(t, { vault: rig.vault, image: { chat: clone(rig.host.ctx.chat), metadata: clone(rig.host.ctx.chatMetadata) }, live });
    await again.settle();
    assert.deepEqual(again.live.state.npcs.map(npc => npc.id), ['npc_mira', 'npc_tom'], 'the memory is hydrated from the store (no sidecar was read)');
    assert.equal(await again.reply('New.', state => { state.npcs.push(record('zed')); }), true);
    assert.deepEqual(Object.keys(again.host.head().domains.people.npcs), ['npc_mira', 'npc_tom', 'npc_zed'], 'the earlier people stay');
});
