import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

// N5 memories (NSD8): the words of a why:, a told lie and a milestone become the person's memory by code; `~ memory` only for a moment no line covers, two a reply, no repeats.
const people = s => s.host.head().domains.people;
const memories = (s, id = 'npc_oren') => people(s).npcs[id]?.memories ?? [];
const stamps = (s, id = 'npc_oren') => people(s).npcs[id]?.memoryStamps ?? {};
const snap = s => JSON.stringify(people(s));
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };

test('a why: becomes that person\'s memory with the reply and its story day; the model writes no ~ memory for it', async () => {
    const s = await suite({ lines: true });
    await s.setDay(3);
    const at = await s.say(['~ npc Oren | trust: +2 | why: He gave back the stolen ring']);
    assert.deepEqual(memories(s), ['He gave back the stolen ring']);
    const [stamp] = Object.values(stamps(s));
    assert.equal(stamp.m, at, 'the reply it belongs to');
    assert.ok(stamp.d, 'the story day is the reply\'s own (B1.1 time)');
    assert.equal(stamp.s, undefined, 'a derived memory is not a ~ memory line\'s');
    same(s, 'replay equals live');
});

test('a told lie and a milestone are memories too; a caught lie and a line with no words are not', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ lie Oren | to: Sister Temiwa | said: I was home all night', '~ npc Oren | trust: +1']);
    assert.deepEqual(memories(s), ['Told Sister Temiwa: I was home all night']);
    await s.say(['~ lie Oren | to: Sister Temiwa | said: I was home all night | caught: yes']);
    assert.equal(memories(s).length, 1, 'catching it saves nothing more');
    same(s, 'replay equals live');
});

test('~ memory: one sentence about a moment no line covers; code owns who and the day', async () => {
    const s = await suite({ lines: true });
    await s.setDay(2);
    const at = await s.say(['~ memory Oren | Confessed to Sister Temiwa that he forged the seal: she kept it quiet.']);
    assert.deepEqual(memories(s), ['Confessed to Sister Temiwa that he forged the seal: she kept it quiet.'], 'a colon inside the sentence stays in it');
    const [stamp] = Object.values(stamps(s));
    assert.equal(stamp.m, at);
    assert.equal(typeof stamp.s, 'string');
    assert.deepEqual(memories(s, 'npc_temiwa'), []);
    same(s, 'replay equals live');
});

test('a third ~ memory in one reply is refused; the cap is per reply, not per person; the next reply may write two more', async () => {
    const s = await suite({ lines: true });
    await quiet(() => s.say(['~ memory Oren | Promised to guard the gate.', '~ memory Sister Temiwa | Shared a joke about the abbot.', '~ memory Oren | Swore never to speak of it.']));
    assert.deepEqual(memories(s), ['Promised to guard the gate.']);
    assert.deepEqual(memories(s, 'npc_temiwa'), ['Shared a joke about the abbot.']);
    await quiet(() => s.say(['~ memory Oren | Lent his cloak to a stranger.', '~ memory Oren | Burned the old letters.']));
    assert.equal(memories(s).length, 3, 'five is the dossier\'s own cap; the next reply\'s own first line counted from zero, the second saved, no third');
    same(s, 'replay equals live');
});

test('a memory already stored, or only reworded, is refused; a why: and a ~ memory of the same moment keep one', async () => {
    const s = await suite({ lines: true });
    await quiet(() => s.say(['~ memory Oren | Promised to guard the gate.']));
    await quiet(() => s.say(['~ memory Oren | Promised to guard the gate.', '~ memory Oren | promised to guard the gate']));
    assert.deepEqual(memories(s), ['Promised to guard the gate.']);
    await quiet(() => s.say(['~ npc Oren | trust: +1 | why: He kept watch', '~ memory Oren | He kept watch']));
    assert.equal(memories(s).filter(text => /kept watch/i.test(text)).length, 1);
    same(s, 'replay equals live');
});

test('~ memory for a person with no record, with no sentence, or about the player is refused and writes nothing', async () => {
    const s = await suite({ lines: true });
    const before = snap(s);
    await quiet(() => s.say(['~ memory Nobody | Did something.', '~ memory Oren |']));
    assert.equal(snap(s), before.replace(/"turn":\d+/, m => m) && snap(s));
    assert.deepEqual(memories(s), []);
    assert.deepEqual(memories(s, 'npc_temiwa'), []);
});

test('a swipe takes the memory away and swiping back restores it; an edited Re-read (grown, shrunk) writes each memory once; a middle delete, a reload and a rewind equal live', async () => {
    const s = await suite({ lines: true });
    const at = await s.say(['~ memory Oren | Promised to guard the gate.']);
    const first = snap(s);
    await s.swipe(['~ memory Oren | Lied about the key.']);
    assert.deepEqual(memories(s), ['Lied about the key.']);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first, 'swipe back restores exactly');
    await reread(s, at);
    await reread(s, at);
    assert.deepEqual(memories(s), ['Promised to guard the gate.'], 'a Re-read writes it once');
    assert.equal(Object.values(stamps(s)).length, 1);
    edit(s, at, ['~ memory Oren | Promised to guard the gate.', '~ memory Sister Temiwa | Shared a joke.', '~ memory Oren | A third one.']);
    await quiet(() => reread(s, at));
    assert.deepEqual(memories(s), ['Promised to guard the gate.'], 'grown: the third is still refused on a Re-read');
    assert.deepEqual(memories(s, 'npc_temiwa'), ['Shared a joke.']);
    same(s, 'grown Re-read replay equals live');
    edit(s, at, ['~ memory Sister Temiwa | Shared a joke.']);
    await reread(s, at);
    assert.deepEqual(memories(s), [], 'shrunk: the first memory goes with its line');
    same(s, 'shrunk Re-read replay equals live');
    const later = await s.say(['~ memory Oren | Kept the watch.']);
    await quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });
    assert.ok(later > at);
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'reload / chat change equals live');
    const head = s.host.store.headIndex();
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    same(s, 'rewind replay equals live');
});

test('switch off: a why: saves no memory and a ~ memory line is refused; the people are as the old line leaves them', async () => {
    const off = await suite({ lines: false });
    await quiet(() => off.say(['~ npc Oren | trust: +2 | why: He gave back the ring', '~ memory Oren | Promised something.']));
    assert.deepEqual(memories(off), []);
    assert.deepEqual(people(off).npcs.npc_oren.memoryStamps, {});
    assert.equal(off.npc('Oren').meters.trust, 1, 'the meter line still works as before (an ordinary line is held to its cap)');
});

test('the two kinds register with no definition problem, with their heads and no grammar line; the static text shows neither', async () => {
    const s = await suite();
    const kinds = s.host.registry.contexts().find(item => item.moduleId === 'npc-state-delta').kinds;
    for (const [kind, head] of [['memory', '~ memory'], ['secret', '~ secret']]) {
        const entry = kinds.find(item => item.kind === kind);
        assert.deepEqual([...entry.heads], [head]);
        assert.equal(entry.grammar, '');
    }
    assert.ok(!/~ (memory|secret)/.test(kinds.map(item => item.grammar).join('\n')), 'untaught until N7');
    assert.equal(s.host.registry.refusals().length, 0);
});

test('a new person starts with empty memory containers, so a later memory survives a middle delete of an earlier one', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['+ npc Marta | clerk | a braid']);
    await s.say(['~ memory Marta | Promised to keep the ledger.']);
    await s.say(['~ memory Marta | Lent a pen.']);
    assert.deepEqual(people(s).npcs.npc_marta.memories, ['Promised to keep the ledger.', 'Lent a pen.']);
    same(s, 'replay equals live');
    const middle = first + 2;
    await quiet(async () => { await s.host.st.deleteMessage(middle); await s.host.st.deleteMessage(middle - 1); });
    assert.deepEqual(people(s).npcs.npc_marta.memories, ['Lent a pen.'], 'the deleted reply\'s memory goes, the later one stays');
    same(s, 'middle delete replay equals live');
});
