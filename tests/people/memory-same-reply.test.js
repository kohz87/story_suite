// DOSSFIX2 item 4 (REV-dossa F1): a why: and a memory: (or a `~ memory` line) that tell the same event in the same reply are one memory, as NPC State's scan merge
// already treats a same-reply retelling (sameReplyRetelling); memories of different replies are never compared that way, so two events sharing words stay two.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

const people = s => s.host.head().domains.people;
const memories = s => people(s).npcs.npc_oren?.memories ?? [];
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };

// Rorke at #19 of the owner's 20 Nov chat: his why: and his ~ memory of one report (scored 0.43 apart by the memory rule, so both were stored).
const DELIVERED = 'Delivered a steady, accurate firsthand report on Hollis Drane\'s wrecked charcoal wagon';
const LISTENED = 'Listened to Astra\'s steady report on Hollis Drane\'s wrecked charcoal wagon and the sheared snare-wire';
const GRANARY = "Astra kept the murdered keeper's granary sealed and brought her quietly without raising a panic";
// REV-dfx2b F1: two different events of one reply that share only the wagon (and a name).
const PULLED = 'Pulled Hollis Drane out from under the wrecked charcoal wagon on the north road';
const WATCHED = 'Watched Hollis Drane sell the wrecked charcoal wagon for scrap at the market';
const COLVIN = 'Astra recovered dead runner Colvin and his intact sealed dispatch from the northern alders without raising a panic';

test('a why: and a memory: on one line telling the same event are one memory', async () => {
    const s = await suite({ lines: true });
    await s.say([`~ npc Oren | trust: +1 | why: ${DELIVERED} | memory: ${LISTENED}`]);
    assert.deepEqual(memories(s), [DELIVERED]);
    same(s, 'replay equals live');
});

test('a ~ memory line retelling the reply\'s why: is not stored again; the same two texts in different replies are both kept', async () => {
    const s = await suite({ lines: true });
    await quiet(() => s.say([`~ npc Oren | trust: +1 | why: ${DELIVERED}`, `~ memory Oren | ${LISTENED}`]));
    assert.deepEqual(memories(s), [DELIVERED]);
    await s.say([`~ npc Oren | memory: ${LISTENED}`]);
    assert.deepEqual(memories(s), [DELIVERED, LISTENED], 'another reply is another memory');
    same(s, 'replay equals live');
});

test('two events sharing a phrase in different replies stay two; a different event in the same reply is kept', async () => {
    const s = await suite({ lines: true });
    await s.say([`~ npc Oren | memory: ${GRANARY}`]);
    await s.say([`~ npc Oren | trust: +1 | why: ${COLVIN} | memory: He saw the tower fall`]);
    assert.deepEqual(memories(s), [GRANARY, COLVIN, 'He saw the tower fall']);
    same(s, 'replay equals live');
});

test('two different events of one reply that share a few words (and a name) are both kept', async () => {
    const s = await suite({ lines: true });
    await s.say([`~ npc Oren | trust: +1 | why: ${PULLED} | memory: ${WATCHED}`]);
    assert.deepEqual(memories(s), [PULLED, WATCHED]);
    same(s, 'replay equals live');
    const t = await suite({ lines: true });
    await quiet(() => t.say([`~ npc Oren | trust: +1 | why: ${PULLED}`, `~ memory Oren | ${WATCHED}`]));
    assert.deepEqual(memories(t), [PULLED, WATCHED], 'a ~ memory line too');
});

test('swipe, swipe back, Re-read, middle delete and reload decide the retelling the same way', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    const at = await s.say([`~ npc Oren | trust: +1 | why: ${DELIVERED} | memory: ${LISTENED}`]);
    const live = snap(s);
    await s.swipe([`~ npc Oren | memory: ${LISTENED}`]);
    assert.deepEqual(memories(s), ['He kept the gate shut', LISTENED]);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back restores exactly');
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(snap(s), live, 'a Re-read decides the same');
    await quiet(async () => { await s.host.st.deleteMessage(first); await s.host.st.deleteMessage(first - 1); });
    assert.deepEqual(memories(s), [DELIVERED]);
    same(s, 'middle delete replay equals live');
    const head = snap(s);
    await s.host.turn.onChatChanged();
    assert.equal(snap(s), head, 'reload equals live');
});

test('after a middle delete a new reply takes an old reply\'s index: it is still another reply, so its memory is kept', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | trust: +1']);
    const told = await s.say([`~ npc Oren | trust: +1 | why: ${DELIVERED}`]);
    await quiet(async () => { await s.host.st.deleteMessage(first); await s.host.st.deleteMessage(first - 1); });
    const next = await s.say([`~ npc Oren | memory: ${LISTENED}`]);
    assert.equal(next, told, 'the new reply sits where the told one was');
    assert.deepEqual(memories(s), [DELIVERED, LISTENED]);
    same(s, 'replay equals live');
});
