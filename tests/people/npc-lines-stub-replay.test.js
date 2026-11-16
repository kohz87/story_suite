import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

// N4 replay: a stub's person and meter entry follow their reply through a swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a rewind,
// a reload and a chat change; replay equals live; a Re-read writes the person once.
const people = s => s.host.head().domains.people;
const ids = s => Object.keys(people(s).npcs).filter(id => !['npc_oren', 'npc_temiwa'].includes(id)).sort();
const bonds = s => Object.keys(people(s).bonds?.npcs ?? {}).sort();
const snap = s => JSON.stringify(people(s));
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };

test('a swipe of the meeting reply takes the person and the meter entry away; swiping back brings them back', async () => {
    const s = await suite({ lines: true });
    const at = await s.say(['+ npc Marta | clerk | a grey braid']);
    assert.deepEqual(ids(s), ['npc_marta']);
    const withMarta = snap(s);
    await s.swipe(['+ npc Dov | ferryman']);
    assert.deepEqual(ids(s), ['npc_dov'], 'the swipe replaces the first answer');
    assert.deepEqual(bonds(s), ['npc_dov']);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), withMarta, 'swiping back restores the first answer exactly');
    same(s, 'swipe back replay equals live');
});

test('an edited Re-read, grown and shrunk, gives what a live write of the edited reply gives; a Re-read writes each person once', async () => {
    const s = await suite({ lines: true });
    const at = await s.say(['+ npc Marta | clerk | a grey braid']);
    await reread(s, at);
    await reread(s, at);
    assert.deepEqual(ids(s), ['npc_marta'], 'exactly once, however often it is read');
    assert.equal(people(s).order.filter(id => id === 'npc_marta').length, 1);
    edit(s, at, ['+ npc Marta | clerk | a grey braid', '+ npc Dov | ferryman | a red scarf', '~ npc Dov | trust: +1']);
    await reread(s, at);
    assert.deepEqual(ids(s), ['npc_dov', 'npc_marta']);
    assert.equal(s.npc('Dov').meters.trust, 1);
    same(s, 'grown Re-read replay equals live');
    edit(s, at, ['+ npc Dov | ferryman | a red scarf']);
    await reread(s, at);
    assert.deepEqual(ids(s), ['npc_dov'], 'a shrunk Re-read takes Marta away');
    assert.deepEqual(bonds(s), ['npc_dov']);
    same(s, 'shrunk Re-read replay equals live');
    edit(s, at, []);
    await reread(s, at);
    assert.deepEqual(ids(s), []);
    same(s, 'emptied Re-read replay equals live');
});

test('a middle delete keeps a later reply\'s writes about the person; a rewind, a reload and a chat change equal live', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['+ npc Marta | clerk | a grey braid']);
    await s.say(['~ npc Marta | goal: find the ledger | trust: +1']);
    await s.say(['+ npc Dov | ferryman']);
    assert.equal(people(s).npcs.npc_marta.goal, 'find the ledger');
    await quiet(async () => {
        await s.host.st.deleteMessage(first);
        await s.host.st.deleteMessage(first - 1);
    });
    assert.deepEqual(ids(s), ['npc_dov'], 'the first reply is gone: so is its person; the later reply about her is refused on replay (no record)');
    assert.equal(people(s).npcs.npc_marta, undefined);
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload equals live');
    const head = s.host.store.headIndex();
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    assert.deepEqual(ids(s), []);
    same(s, 'rewind replay equals live');
});

test('~ npc X before + npc X in one reply: the line before is refused (no record yet) and the stub still makes the person; the same on a Re-read', async () => {
    const s = await suite({ lines: true });
    const at = await quiet(() => s.say(['~ npc Marta | trust: up', '+ npc Marta | clerk | a braid', '~ npc Marta | goal: find the ledger']));
    assert.deepEqual(ids(s), ['npc_marta']);
    assert.equal(people(s).npcs.npc_marta.goal, 'find the ledger');
    assert.equal(s.npc('Marta').meters.trust, 0, 'the refused line moved nothing');
    const live = snap(s);
    await quiet(() => reread(s, at));
    assert.equal(snap(s), live, 'a Re-read of the same text decides the same');
    same(s, 'replay equals live');
});

test('switch off: + npc is the old line (a meter entry, no person), byte for byte', async () => {
    const off = await suite({ lines: false });
    await off.say(['+ npc Marta | clerk | a grey braid', '+ npc Captain Ilse Vorn | trust: +1']);
    assert.deepEqual(ids(off), [], 'no dossier is made by the line');
    assert.deepEqual(bonds(off), ['npc_captain-ilse-vorn', 'npc_marta']);
    assert.equal(off.npc('Captain Ilse Vorn').meters.trust, 1);
});
