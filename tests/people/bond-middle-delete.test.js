// A middle delete of the reply that first made a person's meter record (bonds/npcs/<id>): every later reply's change for them used to
// fail on replay ("…/turn/at does not exist") and be skipped whole, losing its goal, meters and memories. Replay rule (i) remakes the
// record from the dossier (core/ops/holders.js, modules/people/domain/bond-holder.js) and fits the later writes into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';

const people = s => s.host.head().domains.people;
const record = (s, id = 'npc_oren') => people(s).npcs[id] ?? {};
const bond = (s, id = 'npc_oren') => people(s).bonds?.npcs?.[id] ?? null;
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const problems = s => (s.host.store.problems?.() ?? []).map(item => item.message ?? item.code);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const drop = (s, at) => quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });

test('deleting the reply that made the meter record keeps the later replies\' goal, meters and memory (meter line first)', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ npc Oren | goal: rest']);
    await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    assert.equal(bond(s).meters.trust, 2);
    await drop(s, first);
    assert.deepEqual(problems(s), [], 'no block is skipped');
    assert.equal(record(s).goal, 'rest');
    assert.ok(record(s).memories.includes('He kept the gate shut'));
    // A meter move is stored as the number it set, so the last reply's trust stands (as after any middle delete).
    assert.equal(bond(s)?.name, 'Oren');
    assert.equal(bond(s).meters.trust, 2);
    assert.equal(s.npc('Oren').meters.trust, 2);
    same(s, 'middle delete replay equals live');
});

test('a first line with no meter (goal or memory only) made the record: deleting it keeps the later changes', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | goal: guard the gate']);
    await s.say(['~ npc Oren | goal: rest']);
    await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    await drop(s, first);
    assert.deepEqual(problems(s), []);
    assert.equal(record(s).goal, 'rest');
    assert.deepEqual(record(s).memories, ['He kept the gate shut']);
    assert.equal(bond(s).meters.trust, 1);
    same(s, 'replay equals live');

    const t = await suite({ lines: true });
    const tower = await t.say(['~ npc Oren | memory: He saw the tower fall']);
    await t.say(['~ npc Oren | goal: rebuild the bridge | memory: He saw the bridge burn']);
    await drop(t, tower);
    assert.deepEqual(problems(t), []);
    assert.equal(record(t).goal, 'rebuild the bridge');
    assert.deepEqual(record(t).memories, ['He saw the bridge burn']);
    same(t, 'memory-only first line: replay equals live');
});

test('the remade record starts from the dossier\'s numbers, as a first change would', async () => {
    const records = dossiers();
    records.npc_oren.relationship = { trust: 0, affection: 3, desire: 0, tension: 1 };
    const s = await suite({ lines: true, records });
    const first = await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ npc Oren | goal: rest']);
    assert.equal(bond(s).meters.affection, 3);
    await drop(s, first);
    assert.deepEqual(problems(s), []);
    assert.deepEqual(bond(s).meters, { trust: 0, affection: 3, desire: 0, tension: 1 });
    same(s, 'replay equals live');
});

test('after the delete: swipe, swipe back, Re-read, a scan, a new day and reload all equal live', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ npc Oren | goal: rest']);
    const last = await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    await drop(s, first);
    const at = last - 2;
    assert.equal(s.host.store.headIndex(), at);
    const live = snap(s);
    await s.swipe(['~ npc Oren | trust: -1 | why: He let the thief pass']);
    assert.equal(bond(s).meters.trust, -1, 'the deleted reply\'s +1 is gone from the state the swipe starts on');
    assert.ok(record(s).memories.includes('He let the thief pass'));
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back restores exactly');
    // A Re-read tells the reply again on the state after the delete (meters are stored as the numbers they set, so the stored +1 read 2).
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(bond(s).meters.trust, 1);
    assert.ok(record(s).memories.includes('He kept the gate shut'));
    same(s, 'a Re-read: replay equals live');
    // NPC State's scan of the head reply moves a meter on the remade record.
    assert.equal((await s.adapter.adjust({ name: 'Oren', meters: { affection: 2 }, reply: at })).ok, true);
    assert.equal(bond(s).meters.affection, 2);
    same(s, 'a scan after the delete: replay equals live');
    await s.setDay(2);
    await s.say(['~ npc Oren | goal: watch the road']);
    assert.equal(record(s).goal, 'watch the road');
    assert.equal(bond(s).meters.trust, 1);
    assert.equal(bond(s).day, 2, 'the day\'s tick writes the remade record');
    same(s, 'a new day: replay equals live');
    const head = snap(s);
    await s.host.turn.onChatChanged();
    assert.equal(snap(s), head, 'reload equals live');
    assert.deepEqual(problems(s), []);
});
