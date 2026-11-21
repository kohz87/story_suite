// DOSSFIX2 item 6 (REV-dossa F4, F5): at most one memory: a person a reply (a second is refused with a problem line, so six of them can no longer push every
// earlier memory out of the five the dossier keeps), and a `+ npc` line's memory: part is the new person's first memory, never part of their look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { normalizeNpcRecord } from '../../modules/people/core/core.js';

const people = s => s.host.head().domains.people;
const memories = (s, id = 'npc_oren') => people(s).npcs[id]?.memories ?? [];
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const problemTexts = s => (people(s).bonds?.problems ?? []).map(item => item.text);

test('a second memory: for the same person in one reply is refused with a problem line; another person and a why: are not limited', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | trust: +1 | why: He kept the gate shut']);
    await s.say(['~ npc Oren | memory: He saw the tower fall', '~ npc Oren | memory: He saw the bridge burn', '~ npc Sister Temiwa | memory: She tended the sick', '~ npc Oren | trust: +1 | why: He held the line']);
    assert.deepEqual(memories(s), ['He kept the gate shut', 'He saw the tower fall', 'He held the line']);
    assert.deepEqual(memories(s, 'npc_temiwa'), ['She tended the sick']);
    assert.ok(problemTexts(s).some(text => /^Oren: one memory: a reply; this one was not stored\.$/.test(text)), JSON.stringify(problemTexts(s)));
    same(s, 'replay equals live');
    await s.say(['~ npc Oren | memory: He slept in the chapel']);
    assert.equal(memories(s).at(-1), 'He slept in the chapel', 'the next reply has its own memory:');
});

test('the per-reply mark survives the runtime\'s rewrite of the record, so a Continue does not add a second; swipe, Re-read and reload equal live', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | trust: +1']);
    const at = await s.say(['~ npc Oren | memory: He saw the tower fall']);
    const record = normalizeNpcRecord(structuredClone(people(s).npcs.npc_oren));
    assert.equal(typeof Object.values(record.memoryStamps)[0].l, 'string', 'the normalizer keeps the mark');
    await quiet(async () => { await s.host.cont('\n\n<Changes>\n~ npc Oren | memory: He saw the bridge burn\n</Changes>'); await s.adapter.ticked(); });
    assert.deepEqual(memories(s), ['He saw the tower fall'], 'a Continue is the same reply');
    same(s, 'continue replay equals live');
    const live = snap(s);
    await s.swipe(['~ npc Oren | memory: He saw the bridge burn', '~ npc Oren | memory: He saw the harbour flood']);
    assert.deepEqual(memories(s), ['He saw the bridge burn']);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back restores exactly');
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(snap(s), live, 'a Re-read decides the same');
    await s.host.turn.onChatChanged();
    assert.equal(snap(s), live, 'reload equals live');
});

test('memory: on a + npc line is the new person\'s first memory and stays out of their look', async () => {
    const s = await suite({ lines: true });
    const at = await s.say(['+ npc Bram Hale | ferryman | a tall man in oilskins | memory: He ferried Astra across the river']);
    const bram = people(s).npcs['npc_bram-hale'];
    assert.equal(bram.appearance, 'a tall man in oilskins');
    assert.deepEqual(bram.memories, ['He ferried Astra across the river']);
    assert.equal(Object.values(bram.memoryStamps)[0].m, at);
    same(s, 'replay equals live');
    const t = await suite({ lines: false });
    await quiet(() => t.say(['+ npc Bram Hale | ferryman | a tall man in oilskins | memory: He ferried Astra across the river']));
    assert.deepEqual(people(t).npcs['npc_bram-hale']?.memories ?? [], [], 'lines off: as before');
});
