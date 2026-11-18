import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

// SOAKPEOPLE F50 (a first name, surname or role finds the one person it fits), F34 (a tie's with: must name someone with a record)
// and F44 (lines about a person who has died change nothing, and + present cannot bring them back). Lines mode only.
const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
const rec = (id, name, extra = {}) => ({ id, name, aliases: [], present: false, memories: [], memoryStamps: {}, relationship: { ...blank }, ...extra });
const records = () => ({
    npc_hesk_dalla: rec('npc_hesk_dalla', 'Hesk Dalla', { role: 'the Watch-Captain' }),
    npc_wenna_coll: rec('npc_wenna_coll', 'Wenna Coll', { aliases: ['Old Wen'] }),
    npc_ovren_tash: rec('npc_ovren_tash', 'Ovren Tash'),
});
const people = s => s.host.head().domains.people;
const bond = (s, id) => people(s).bonds?.npcs?.[id];
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const reply = (story, lines) => `${story}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const say = async (s, lines, story = 'The watch changed at the gate.') => { await quiet(async () => { await s.host.send('And then?', reply(story, lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reread = async (s, at) => assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);

test('F50: a first name, a surname with a title and a role find the one person; + npc of a first name makes no second person', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await say(s, ['~ npc Hesk | trust: +1', '~ npc Captain Dalla | affection: +1', '~ npc the Watch-Captain | tension: +1', '~ npc Wenna | trust: +1', '+ npc Hesk | the captain | tall']);
    assert.deepEqual([bond(s, 'npc_hesk_dalla')?.meters?.trust, bond(s, 'npc_hesk_dalla')?.meters?.affection, bond(s, 'npc_hesk_dalla')?.meters?.tension], [1, 1, 1]);
    assert.equal(bond(s, 'npc_wenna_coll')?.meters?.trust, 1);
    assert.deepEqual(Object.keys(people(s).npcs).sort(), ['npc_hesk_dalla', 'npc_ovren_tash', 'npc_wenna_coll'], 'no second "Hesk"');
    assert.deepEqual(Object.keys(people(s).bonds.npcs).sort(), ['npc_hesk_dalla', 'npc_wenna_coll'], 'no meter entry under a first name');
    same(s, 'replay equals live');
    s.host.ctx.chat[at].mes = reply('Edited.', ['~ npc Hesk | trust: +1']);
    await reread(s, at);
    assert.equal(bond(s, 'npc_hesk_dalla')?.meters?.affection, 0, 'shrunk Re-read');
    assert.equal(bond(s, 'npc_hesk_dalla')?.meters?.trust, 1);
    same(s, 'edited Re-read equals live');
});

test('F50: a new person who shares a first name is still made, and the first name alone then fits two people (refused)', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, ['+ npc Hesk Varn | smith | broad hands']);
    assert.ok(Object.values(people(s).npcs).some(record => record.name === 'Hesk Varn'));
    await say(s, ['~ npc Hesk | trust: +1', '~ npc Hesk Varn | affection: +1']);
    assert.equal(bond(s, 'npc_hesk_dalla')?.meters?.trust ?? 0, 0, 'two people fit "Hesk": nobody is changed');
    const varn = Object.entries(people(s).npcs).find(([, record]) => record.name === 'Hesk Varn')[0];
    assert.equal(bond(s, varn)?.meters?.affection, 1);
    same(s, 'replay equals live');
});

test('F34: a tie with someone who has no record is refused; a tie with a first name is stored under the full name', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, ['~ tie Wenna Coll | with: Nobody Known | tag: +friend']);
    assert.equal(bond(s, 'npc_wenna_coll')?.ties, undefined, 'nothing stored for an unknown person');
    await say(s, ['~ tie Wenna | with: Hesk | tag: +friend']);
    assert.deepEqual(JSON.parse(bond(s, 'npc_wenna_coll').ties), { 'hesk-dalla': ['friend'] });
    same(s, 'replay equals live');
});

test('F10: a stored tie is an edge of people.ties (the People map) and a tie line of the dossier; a swipe takes it back', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, ['~ tie Wenna Coll | with: Hesk Dalla | tag: +friend', '~ tie Ovren Tash | with: Hesk Dalla | tag: +enemy']);
    assert.deepEqual(s.host.sdk.query('people.ties', {}), [
        { aId: 'npc_wenna_coll', bId: 'npc_hesk_dalla', aToB: 'friend', bToA: '' },
        { aId: 'npc_ovren_tash', bId: 'npc_hesk_dalla', aToB: 'enemy', bToA: '' },
    ], 'in dossier order');
    assert.deepEqual(s.host.sdk.query('people.dossier', { id: 'npc_wenna_coll' }).keyRelationships, ['Hesk Dalla — friend']);
    await quiet(async () => { await s.host.swipe(reply('Another way.', [])); await s.adapter.ticked(); });
    assert.deepEqual(s.host.sdk.query('people.ties', {}), [], 'the swipe has no tie');
});

test('F44: after a death, ~ npc, ~ memory and + present about them change nothing; a swipe of the death brings them back', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await say(s, ['+ present Ovren Tash', '~ npc Ovren Tash | died | how: a knife in the fog']);
    assert.equal(people(s).npcs.npc_ovren_tash.lifeState, 'deceased');
    const before = JSON.stringify(people(s).npcs.npc_ovren_tash);
    await say(s, ['- present Ovren Tash']);
    await say(s, ['+ present Ovren Tash', '~ npc Ovren | trust: +1', '~ memory Ovren Tash | He spoke again.']);
    assert.equal(JSON.stringify(people(s).npcs.npc_ovren_tash), before, 'the record is unchanged');
    assert.equal(bond(s, 'npc_ovren_tash')?.meters?.trust ?? 0, 0);
    assert.equal(s.host.head().domains.scene.present.includes('Ovren Tash'), false, '+ present is refused for the dead');
    same(s, 'replay equals live');
    await quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });
    assert.notEqual(people(s).npcs.npc_ovren_tash.lifeState, 'deceased', 'a middle delete of the death');
    same(s, 'middle delete equals live');
});

test('F44/F50 switch off: lines go the old way (no short-name match, no death refusal from the lines)', async () => {
    const s = await suite({ lines: false, records: records() });
    await say(s, ['~ npc Hesk | trust: +1']);
    assert.equal(bond(s, 'npc_hesk_dalla')?.meters?.trust ?? 0, 0, 'off: "Hesk" is not Hesk Dalla, as on main');
});

test('F41: with "Who gets a dossier: Manual only" a + npc line makes nobody; Conservative still makes them', async () => {
    const manual = await suite({ lines: true, records: records(), settings: { admissionMode: 'manual_only' } });
    await say(manual, ['+ npc Tamsa Vell | the clerk | ink-stained cuffs']);
    assert.equal(Object.values(people(manual).npcs).some(record => record.name === 'Tamsa Vell'), false);
    same(manual, 'replay equals live');
    const usual = await suite({ lines: true, records: records(), settings: { admissionMode: 'conservative' } });
    await say(usual, ['+ npc Tamsa Vell | the clerk | ink-stained cuffs']);
    assert.equal(Object.values(people(usual).npcs).some(record => record.name === 'Tamsa Vell'), true);
});
