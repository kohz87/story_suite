import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';

// N3 fix round: a `~ npc` line obeys the reader's locks and the death freeze; "here" is the reply's own scene; no ghost bond; the replay checks.
const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
const person = (id, name, extra = {}) => ({ id, name, aliases: [], present: false, archived: false, relationship: { ...blank }, ...extra });
const records = () => ({
    ...dossiers(),
    npc_wren: person('npc_wren', 'Wren', { goal: 'reader goal', location: 'the keep', manualProfileFields: ['goal', 'location'] }),
    npc_mara: person('npc_mara', 'Mara', { goal: 'old goal', status: 'dying', location: 'the crypt', gender: 'female', lifeState: 'deceased', archived: true }),
    npc_kit: person('npc_kit', 'Kit'),
});
const dossier = (s, id) => s.host.head().domains.people.npcs[id];
const problems = s => JSON.stringify(s.host.head().domains.people.bonds.problems);
const snapshot = s => JSON.stringify([s.host.head().domains.people.bonds, s.host.head().domains.people.npcs]);
const same = (s, why) => { const live = snapshot(s); s.host.store.rebuild(); assert.equal(snapshot(s), live, why); };

test('a locked field stays; an unlocked field of the same line applies; replay equals live', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ npc Wren | goal: steal the ledger | where: the docks | status: limping']);
    assert.equal(dossier(s, 'npc_wren').goal, 'reader goal');
    assert.equal(dossier(s, 'npc_wren').location, 'the keep');
    assert.equal(dossier(s, 'npc_wren').status, 'limping');
    assert.match(problems(s), /goal is locked by you/);
    assert.match(problems(s), /where is locked by you/);
    same(s, 'replay equals live');
});

test('a dead person\'s goal, status, where and gender stay; look still applies', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ npc Mara | where: the hall | status: walking | goal: revenge | gender: male | look: pale']);
    const mara = dossier(s, 'npc_mara');
    assert.deepEqual([mara.location, mara.status, mara.goal, mara.gender], ['the crypt', 'dying', 'old goal', 'female']);
    assert.match(problems(s), /Mara has died; where is not changed/);
    same(s, 'replay equals live');
});

test('where reads only the reply\'s scene: + present then - present then where: is accepted; a Re-read decides the same', async () => {
    const s = await suite({ records: records() });
    await s.say(['+ present Kit']);
    const at = await s.say(['- present Kit', '~ npc Kit | where: the market']);
    assert.equal(dossier(s, 'npc_kit').location, 'the market');
    const edit = lines => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
    edit(['- present Kit', '~ npc Kit | where: the quay']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(dossier(s, 'npc_kit').location, 'the quay');
    edit(['+ present Kit', '~ npc Kit | where: the pier']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(dossier(s, 'npc_kit').location, undefined, 'a Re-read replaces the reply\'s writes; + present before the where: line refuses it');
    same(s, 'replay equals live');
});

test('dossier labels alone for a name with no bond or dossier create no bond record', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ npc Stranger Bob | where: the harbour']);
    assert.deepEqual(Object.keys(s.host.head().domains.people.bonds.npcs).filter(id => /bob/.test(id)), []);
    await s.say(['~ npc Kit | goal: find x']);
    assert.equal(dossier(s, 'npc_kit').goal, 'find x', 'someone with a dossier still takes labels');
});

test('mood refusal says mood is off when that is why', async () => {
    const off = await suite({ records: records(), features: { 'npc-state-delta.mood-pull': false } });
    await off.say(['~ npc Kit | mood: furious']);
    assert.match(problems(off), /mood is off/);
    const noClock = await suite({ records: records(), clock: false });
    await noClock.say(['~ npc Kit | mood: furious']);
    assert.match(problems(noClock), /no story clock/);
    await noClock.say(['~ npc Kit | mood: zzzxq']);
    assert.match(problems(noClock), /no story clock/);
});

test('a place line and a ~ npc where: in one reply: the person is away from the scene so where applies', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ npc Kit | where: the docks', '~ place The docks']);
    assert.equal(dossier(s, 'npc_kit').location, 'the docks');
    same(s, 'replay equals live');
});

test('two gender: lines keep the first; a mixed trust: up and trust: +3 line is not a crash; rewind and reload equal live', async () => {
    const s = await suite({ records: records() });
    const first = await s.say(['~ npc Kit | gender: female', '~ npc Kit | gender: male | trust: up | trust: +3']);
    assert.equal(dossier(s, 'npc_kit').gender, 'female');
    same(s, 'reload equals live');
    await s.host.st.deleteMessage(first);
    await s.host.st.deleteMessage(first - 1);
    assert.equal(dossier(s, 'npc_kit').gender, undefined, 'rewind takes the reply\'s fields away');
    same(s, 'replay equals live after the rewind');
});

test('a Re-read that writes + present AFTER the ~ npc where: line still refuses it (present lines run first, wherever they stand); the place line likewise', async () => {
    const s = await suite({ records: records() });
    const at = await s.say(['~ npc Kit | where: the market']);
    assert.equal(dossier(s, 'npc_kit').location, 'the market');
    const edit = lines => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
    edit(['~ npc Kit | where: the pier', '+ present Kit']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(dossier(s, 'npc_kit').location, undefined, 'the line after + present is refused, as it is when + present stands first');
    edit(['~ npc Kit | where: the quay', '~ place The quay']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.equal(dossier(s, 'npc_kit').location, 'the quay', 'a place line after the where: line leaves Kit away from the scene, so where applies');
    same(s, 'replay equals live');
});
