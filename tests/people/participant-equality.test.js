// The people domain across both packages (J07 step 5): the live Story Block host with the flag on, NPC State Delta's real participant and mirror.
// Equality is claimed at the head once the participant has settled: `head.domains.people` equals `peopleView(Delta's state)`.
// Delta's own ids (`npc_myla`) are mirrored as they are. A known gap is asserted as it is today, not hidden: a Re-read after a middle delete is
// refused (J09's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { peopleRig, record, idOf } from './helpers/people-rig.js';
import { hashJson } from '../../packages/npc-state-delta/src/storysuite-participant/hash.js';

const people = rig => rig.host.head().domains.people ?? null;
const same = (rig, label) => assert.equal(hashJson(people(rig)), hashJson(rig.expected()), `${label}: the head's people equal the view of Delta's state`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settled(rig, label) { assert.equal(await rig.settle(), true, `${label}: settled`); same(rig, label); }

// What Delta changes at reply n: a new person at 3, 7 and 11, a moving stage and trust, a candidate, an edge, a portrait, a dismissal.
function edit(n) {
    return state => {
        state.turn = n + 1;
        state.npcs[0].trust = n;
        state.npcs[1].stage = n % 4;
        if (n % 4 === 3) state.npcs.push(record(`p${n}`, { stage: 1 }));
        state.candidates = n % 2 ? [{ name: `Wren ${n}` }] : [];
        state.socialGraph = n > 2 ? { edges: [{ a: state.npcs[0].id, b: state.npcs[1].id, kind: `kind${n % 3}` }] } : { edges: [] };
        state.portraitAssets = n > 5 ? { [state.npcs[0].id]: `portrait-${n}.png` } : {};
        state.dismissed = n > 8 ? ['someone'] : [];
        state.updatedAt = Date.now();          // clock keys never reach the host
    };
}

test('a 12-reply script: after every reply the head equals the view of the state, and the clock keys stay out', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 12; n++) {
        assert.equal(await rig.reply(`Turn ${n}.`, edit(n)), true, `reply ${n} settled`);
        same(rig, `reply ${n}`);
    }
    assert.equal(rig.host.head().domains.people.npcs[idOf('mira')].trust, 12);
    assert.equal(JSON.stringify(people(rig)).includes('updatedAt'), false);
    assert.deepEqual(rig.warnings, []);
    assert.ok(rig.sends.length >= 12 && rig.sends.every(code => code === 'ok'), `every send was accepted: ${rig.sends}`);
});

test('a head swipe and swiping back: the people follow the selected swipe', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 3; n++) await rig.reply(`Turn ${n}.`, edit(n));
    const first = structuredClone(people(rig));
    await rig.host.swipe('Another reply.');
    await rig.publish(state => { state.npcs[0].trust = 99; state.turn = 40; });
    await settled(rig, 'second swipe');
    assert.equal(people(rig).npcs[idOf('mira')].trust, 99);
    const index = rig.host.store.headIndex();
    await rig.host.st.swipeTo(index, 0);
    await sleep(300);
    await settled(rig, 'first swipe again');
    assert.deepEqual(people(rig), first, 'the first swipe brings its people back');
});

test('a head delete, then a middle delete: equal once the participant has settled', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 5; n++) await rig.reply(`Turn ${n}.`, edit(n));
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    await sleep(300);
    await settled(rig, 'head delete');
    await rig.host.st.deleteMessage(2);
    await sleep(300);
    await settled(rig, 'middle delete');
    await rig.reply('After.', edit(6));
    same(rig, 'a reply after the deletes');
});

test('reload and store.rebuild(): the chat read again gives the same people', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    const before = structuredClone(people(rig));
    const again = await rig.reload();
    await sleep(300);
    assert.deepEqual(people(again), before, 'the reload keeps the people');
    same(again, 'reload');
    again.host.store.rebuild();
    await sleep(100);
    assert.deepEqual(people(again), before, 'a rebuild keeps the people');
    same(again, 'rebuild');
});

test('known gap (J09): a Re-read after a middle delete is refused, though the people are equal at the head', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) await rig.reply(`Turn ${n}.`, edit(n));
    await rig.host.st.deleteMessage(2);
    await sleep(300);
    await settled(rig, 'middle delete');
    const done = await rig.host.turn.reread(rig.host.store.headIndex());
    assert.equal(done.ok, false, 'today the Re-read is refused');
    assert.match(done.message, /does not exist \(no "people"\)/);
    same(rig, 'after the refused Re-read');
});

test('Delta\'s own ids (npc_myla) are mirrored: all 15 frozen write paths reach equality at the head', async t => {
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
        same(rig, key);
    }
    assert.equal(rig.sends.includes('INVALID'), false, `no send refused: ${rig.sends}`);
    assert.deepEqual(rig.warnings, []);
});

test('an id that is not Delta\'s, or is unsafe as a path, is refused and nothing is stored', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Hello.');
    const before = structuredClone(people(rig));
    for (const bad of ['a/b', 'npc_a~b', 'npc_', 'myla', '__proto__']) {
        const out = await rig.host.sdk.command('people.mirror', { v: 1, source: (await rig.host.sdk.timeline.head()).source, view: { v: 1, order: [bad], npcs: { [bad]: { id: bad } } } });
        assert.equal(out.ok, false, `${bad} refused`);
    }
    assert.deepEqual(people(rig), before);
});

test('the participant has not started: the head event still mirrors Delta\'s state, and no publication happened', async t => {
    const rig = await peopleRig(t, { started: false });
    await rig.reply('One.', edit(1));
    assert.equal(rig.live.state.timeline, undefined, 'no line was minted');
    assert.deepEqual((await rig.host.sdk.timeline.status()).participants, [], 'the host holds no checkpoint of Delta\'s');
    same(rig, 'not started');
});
