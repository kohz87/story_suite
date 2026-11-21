// DOSSFRESH (owner, 21 Nov): Dora had no meter lines from #8 to #16, so her replies wrote no memory and her dossier's last change stayed on an older reply until a
// Refresh. `~ npc Name | memory: ...` stores one memory as a why: does; a line's goal, mood or memory stamps the dossier's "changed at" reply (fieldChangeMessages).
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { normalizeName } from '../../modules/people/core/core-text.js';
import { selectDossier } from '../../ui/select/dossier.js';

const people = s => s.host.head().domains.people;
const record = (s, id = 'npc_oren') => people(s).npcs[id] ?? {};
const memories = (s, id) => record(s, id).memories ?? [];
const snap = s => JSON.stringify(people(s));
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const GRANARY = "Astra kept the murdered keeper's granary sealed and brought her quietly without raising a panic";
const COLVIN = 'Astra recovered dead runner Colvin and his intact sealed dispatch from the northern alders without raising a panic';

test('memory: on a ~ npc line stores one memory with the reply and its story day, and stamps the dossier\'s last change', async () => {
    const s = await suite({ lines: true });
    await s.setDay(3);
    const at = await s.say(['~ npc Oren | memory: Astra brought back Colvin\'s body']);
    assert.deepEqual(memories(s), ['Astra brought back Colvin\'s body']);
    const stamp = record(s).memoryStamps[normalizeName('Astra brought back Colvin\'s body')];
    assert.equal(stamp.m, at);
    assert.ok(stamp.d, 'the reply\'s story day');
    assert.equal(stamp.s, undefined, 'not a ~ memory line\'s: the two-a-reply cap is not spent');
    assert.equal(record(s).fieldChangeMessages?.memories, at);
    assert.ok(!/memory/.test(JSON.stringify(s.host.registry.refusals?.() ?? [])), 'the line is not refused');
    same(s, 'replay equals live');
});

test('a line with a why: and a memory: stores both; a memory: already stored is not stored twice; two events sharing a phrase are both kept', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut | memory: He heard the bell ring thirteen times']);
    assert.deepEqual(memories(s), ['He kept the gate shut', 'He heard the bell ring thirteen times']);
    await s.say(['~ npc Oren | memory: He heard the bell ring thirteen times']);
    assert.equal(memories(s).length, 2, 'a repeat is not stored');
    await s.say([`~ npc Oren | trust: +1 | why: ${GRANARY}`]);
    await s.say([`~ npc Oren | memory: ${COLVIN}`]);
    assert.deepEqual(memories(s).slice(-2), [GRANARY, COLVIN], 'a shared "without raising a panic" does not merge two events');
    same(s, 'replay equals live');
});

test('a goal or mood line stamps its reply as the dossier\'s last change (the dossier no longer waits for a Refresh)', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    const at = await s.say(['~ npc Oren | goal: find the missing oil cart']);
    assert.equal(record(s).goal, 'find the missing oil cart');
    assert.equal(record(s).fieldChangeMessages?.goal, at);
    const vm = selectDossier({ dossier: s.host.sdk.query('people.dossier', { id: 'npc_oren' }), meters: s.npc('Oren') });
    assert.equal(vm.lastReply, at, 'the dossier\'s last change is this reply');
    const again = await s.say(['~ npc Oren | goal: find the missing oil cart']);
    assert.equal(record(s).fieldChangeMessages.goal, at, 'the same goal again changes nothing, so no new stamp');
    assert.ok(again > at);
    same(s, 'replay equals live');
});

test('swipe, Re-read, Continue, middle delete and reload: the memory and the stamps are decided the same way as live', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | trust: +1']);   // (the bond record: a middle delete of the reply that made it is another matter, not this one)
    const first = await s.say(['~ npc Oren | goal: guard the gate | memory: He swore to guard the gate']);
    const at = await s.say(['~ npc Oren | memory: He saw the tower fall']);
    const live = snap(s);
    await s.swipe(['~ npc Oren | memory: He saw the bridge burn']);
    assert.deepEqual(memories(s).slice(-1), ['He saw the bridge burn']);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back restores exactly');
    await reread(s, at);
    assert.equal(snap(s), live, 'a Re-read decides the same');
    await quiet(async () => { await s.host.cont('\n\n<Changes>\n~ npc Oren | memory: He saw the tower fall\n</Changes>'); await s.adapter.ticked(); });
    assert.equal(memories(s).filter(text => /tower fall/.test(text)).length, 1, 'a Continue repeating it stores nothing more');
    same(s, 'continue replay equals live');
    const later = await s.say(['~ npc Oren | goal: rest | memory: He slept in the chapel']);
    // the reply that made the stamps container goes: the later replies keep their changes (their stamps are passed over where they no longer fit)
    await quiet(async () => { await s.host.st.deleteMessage(first); await s.host.st.deleteMessage(first - 1); });
    assert.ok(later > first);
    assert.deepEqual(memories(s), ['He saw the tower fall', 'He slept in the chapel']);
    assert.equal(record(s).goal, 'rest');
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'reload equals live');
});

test('lines off: memory: stores nothing and the rest of the line works as before; someone who has died remembers nothing new', async () => {
    const off = await suite({ lines: false });
    await quiet(() => off.say(['~ npc Oren | trust: +1 | memory: He saw the tower fall']));
    assert.deepEqual(memories(off), []);
    assert.equal(off.npc('Oren').meters.trust, 1, 'the rest of the line works as before');
    const s = await suite({ lines: true });
    await quiet(() => s.say(['~ npc Oren | died | how: He fell from the tower.']));
    assert.equal(record(s).lifeState, 'deceased');
    await quiet(() => s.say(['~ npc Oren | memory: He saw the tower fall']));
    assert.deepEqual(memories(s), []);
});
