// The one timeline (PEOPLE-PLAN P3): the Story Block store holds the people and NPC State's memory is a cache hydrated from it. After every reply and after each
// swipe, delete, rebuild, reload, Re-read and branch the check is made at the head with NO publication in between (no nudge): the cache equals the store's slice, the
// slice equals the oracle's rebuild of the chat, and npc.known / npc.dossier / npc.identity answer the store's people (helpers/proofs.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { peopleRig, record, idOf } from './helpers/people-rig.js';
import { proveHead } from './helpers/proofs.js';
import { hashJson } from '../../packages/npc-state-delta/src/storysuite-participant/hash.js';

const people = rig => rig.host.head().domains.people ?? null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// What Delta changes at reply n: a new person at 3, 7 and 11, a moving stage and trust, a candidate, an edge, a portrait, a dismissal.
function edit(n) {
    return state => {
        state.turn = n + 1;
        state.npcs[0].trust = n;
        state.npcs[1].stage = n % 4;
        if (n % 4 === 3) state.npcs.push(record(`p${n}`, { stage: 1 }));
        state.candidates = n % 2 ? [{ name: `Wren ${n}` }] : [];
        state.socialGraph = n > 2 ? { edges: [{ a: state.npcs[0].id, b: state.npcs[1].id, kind: `kind${n % 3}` }] } : { edges: [] };
        state.portraitAssets = n > 5 ? { [state.npcs[0].id]: { path: `/user/files/portrait-${n}.png`, type: 'image/png', hash: `h${n}` } } : {};
        state.dismissed = n > 8 ? ['someone'] : [];
        state.updatedAt = Date.now();          // clock keys never reach the host
    };
}

test('a 12-reply script: after every reply the head, the cache and the oracle agree, and the clock keys stay out', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 12; n++) {
        assert.equal(await rig.reply(`Turn ${n}.`, edit(n)), true, `reply ${n} settled`);
        await proveHead(rig, `reply ${n}`);
    }
    assert.equal(rig.host.head().domains.people.npcs[idOf('mira')].trust, 12);
    assert.equal(JSON.stringify(people(rig)).includes('updatedAt'), false);
    assert.deepEqual(rig.warnings, []);
    assert.ok(rig.sends.length >= 12 && rig.sends.every(code => code === 'ok'), `every send was accepted: ${rig.sends}`);
});

test('the first people.write does not wait for a participant, a save point or an identity query', async t => {
    const rig = await peopleRig(t);
    await rig.reply('One.', edit(1));
    assert.equal(rig.live.state.timeline, undefined, 'no story line was minted');
    assert.deepEqual((await rig.host.sdk.timeline.status()).participants, [], 'the host holds no participant checkpoint of Delta\'s');
    assert.ok(rig.sends.length >= 1 && rig.sends.every(code => code === 'ok'), `the first reply was stored: ${rig.sends}`);
    await proveHead(rig, 'first reply');
});

test('a head swipe and swiping back: the people follow the selected swipe, with no publication in between', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 3; n++) await rig.reply(`Turn ${n}.`, edit(n));
    const first = structuredClone(people(rig));
    await rig.host.swipe('Another reply.');
    await proveHead(rig, 'new swipe (carries the people of before it)');
    await rig.publish(state => { state.npcs[0].trust = 99; state.turn = 40; });
    await proveHead(rig, 'second swipe changed');
    assert.equal(people(rig).npcs[idOf('mira')].trust, 99);
    await rig.host.st.swipeTo(rig.host.store.headIndex(), 0);
    await proveHead(rig, 'swipe back');
    assert.deepEqual(people(rig), first, 'the first swipe brings its people back');
});

test('last delete and middle delete: the cache follows the store at once', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 5; n++) await rig.reply(`Turn ${n}.`, edit(n));
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    await proveHead(rig, 'last delete');
    await rig.host.st.deleteMessage(2);
    await proveHead(rig, 'middle delete');
    await rig.reply('After.', edit(6));
    await proveHead(rig, 'a reply after the deletes');
});

test('reload: the cache starts empty and is hydrated from the store; the next reply keeps the earlier people', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    const before = structuredClone(people(rig));
    const again = await rig.reload();
    assert.deepEqual(again.live.state.npcs.length >= 0, true);
    await proveHead(again, 'reload');
    assert.deepEqual(people(again), before, 'the reload keeps the people');
    assert.ok(again.live.state.npcs.length >= 2, 'NPC State\'s memory holds the people again');
    assert.ok(again.hydrations.length >= 1, 'a hydrate ran');
    assert.equal(await again.reply('New.', state => { state.npcs.push(record('zed')); }), true);
    assert.deepEqual(Object.keys(people(again).npcs).includes('npc_zed') && Object.keys(people(again).npcs).includes('npc_mira'), true, 'the earlier people stay');
    await proveHead(again, 'reply after reload');
    again.host.store.rebuild();
    await sleep(100);
    await proveHead(again, 'rebuild');
});

test('a hydrate sends nothing (no write loop) and a round trip of the view is exact', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    const again = await rig.reload();
    await proveHead(again, 'reload');
    await sleep(100);
    assert.deepEqual(again.sends.slice(rig.sends.length), [], 'the reload sent no people.write');
});

test('a Re-read after a middle delete is ok, and the cache equals the store', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    await rig.host.st.deleteMessage(2);
    await proveHead(rig, 'middle delete');
    const done = await rig.host.turn.reread(rig.host.store.headIndex());
    assert.equal(done.ok, true, done.message);
    await proveHead(rig, 'after the Re-read');
});

test('a branch from a message (SillyTavern) opens with the people of that message', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    await rig.host.ctx.branchChat(rig.host.ctx.chat.length - 3);
    await proveHead(rig, 'branch');
    assert.ok(Object.keys(people(rig).npcs).length >= 2);
});

test('Delta\'s own ids (npc_myla) are stored: all 15 frozen write paths reach equality at the head', async t => {
    const golden = JSON.parse(fs.readFileSync(new URL('../../packages/npc-state-delta/tests/fixtures/field-paths-golden.json', import.meta.url), 'utf8'));
    const asState = (key, value) => (key === 'editorNormalize' ? { npcs: [value] } : Array.isArray(value) ? { npcs: value } : value);
    const rig = await peopleRig(t);
    await rig.reply('Hello.');
    const keys = Object.keys(golden);
    assert.equal(keys.length, 15);
    for (const key of keys) {
        const next = asState(key, golden[key]);
        const done = await rig.publish(state => {
            for (const field of Object.keys(state)) if (field !== 'timeline') delete state[field];
            Object.assign(state, structuredClone(next), { checkpoints: [], lineage: [] });
        });
        assert.equal(done, true, `${key}: settled ${rig.sends.slice(-2)} ${rig.warnings.at(-1)}`);
        // (the dossier hash, as NPC State's sync compares it: the slice also holds the meters, `bonds`, which the view does not)
        assert.equal(rig.host.sdk.query('people.hash', { dossiers: true }), hashJson(rig.expected()), `${key}: the head equals the view of Delta's state`);
    }
    assert.equal(rig.sends.includes('INVALID'), false, `no send refused: ${rig.sends}`);
    assert.deepEqual(rig.warnings, []);
});

test('an id that is not Delta\'s, or is unsafe as a path, is refused and nothing is stored', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Hello.');
    const before = structuredClone(people(rig));
    for (const bad of ['a/b', 'npc_a~b', 'npc_', 'myla', '__proto__']) {
        const out = await rig.host.sdk.command('people.write', { v: 1, source: (await rig.host.sdk.timeline.head()).source, view: { v: 1, order: [bad], npcs: { [bad]: { id: bad } } } });
        assert.equal(out.ok, false, `${bad} refused`);
    }
    assert.deepEqual(people(rig), before);
});
