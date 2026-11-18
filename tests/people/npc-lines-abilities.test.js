import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { abilityFields } from '../../modules/people/meters/npc-lines-parts/abilities.js';

// `~ npc Name | learns: <ability> — <line>` and `keepsake: + / -` (lines mode, always on, RPG not needed) write the built-in Abilities and Keepsakes.
const dossier = (s, id = 'npc_oren') => s.host.head().domains.people.npcs[id];
const abilities = (s, id) => (dossier(s, id).abilities ?? []).map(entry => entry.name);
const keepsakes = (s, id) => (dossier(s, id).keepsakes ?? []).map(entry => entry.name);
const problems = s => JSON.stringify(s.host.head().domains.people.bonds.problems);
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };

test('learns adds an ability with its line; the same name again (any case) is not added twice', async () => {
    const s = await suite({ lines: true });
    await s.say(['~ npc Oren | learns: Shield wall — drilled with the guard']);
    assert.deepEqual(dossier(s).abilities, [{ name: 'Shield wall', description: 'drilled with the guard' }]);
    await s.say(['~ npc Oren | learns: shield WALL — again']);
    assert.deepEqual(abilities(s), ['Shield wall']);
    assert.match(problems(s), /already one of their abilities/);
    await s.say(['~ npc Oren | learns: Lockpicking | trust: up']);
    assert.deepEqual(abilities(s), ['Shield wall', 'Lockpicking']);
    assert.ok(s.npc('Oren').meters.trust > 0, 'the line\'s meters still apply');
});

test('keepsake + adds, keepsake - removes; a missing one is a note; with RPG off nothing changes', async () => {
    const s = await suite({ lines: true, levelOn: false });
    await s.say(['~ npc Oren | keepsake: + Brass key — opens the cellar']);
    assert.deepEqual(dossier(s).keepsakes, [{ name: 'Brass key', description: 'opens the cellar' }]);
    await s.say(['~ npc Oren | keepsake: - brass key']);
    assert.equal(dossier(s).keepsakes, undefined);
    await s.say(['~ npc Oren | keepsake: - Ring']);
    assert.match(problems(s), /not one of their keepsakes/);
    await s.say(['~ npc Oren | keepsake: Brass key']);
    assert.match(problems(s), /is not \\"\+ name/);
});

test('limits: a name is cut at 60 and a description at 200; a 17th ability and a 13th keepsake are refused with a note', async () => {
    const s = await suite({ lines: true });
    await s.say([`~ npc Oren | learns: ${'N'.repeat(80)} — ${'d'.repeat(250)}`]);
    assert.equal(dossier(s).abilities[0].name.length, 60);
    assert.equal(dossier(s).abilities[0].description.length, 200);
    const full = { abilities: Array.from({ length: 16 }, (_, i) => ({ name: `A${i}`, description: '' })), keepsakes: Array.from({ length: 12 }, (_, i) => ({ name: `K${i}`, description: '' })) };
    const f = await suite({ lines: true, records: { ...dossiers(), npc_oren: { ...dossiers().npc_oren, ...full } } });
    await f.say(['~ npc Oren | learns: Extra', '~ npc Oren | keepsake: + Extra']);
    assert.equal(abilities(f).length, 16);
    assert.equal(keepsakes(f).length, 12);
    assert.match(problems(f), /already have 16 abilities/);
    assert.match(problems(f), /already have 12 keepsakes/);
});

test('abilityFields: the reader\'s own cases', () => {
    assert.deepEqual(abilityFields({}, {}), { set: {}, problems: [] });
    assert.deepEqual(abilityFields({ learns: 'Fire — hot' }, null).set, { learns: 'Fire — hot' });
    assert.match(abilityFields({ learns: '' }, {}).problems[0], /names no ability/);
    assert.deepEqual(abilityFields({ keepsake: '- Ring' }, { keepsakes: [{ name: 'ring', description: '' }] }).set, { keepsake: '- Ring' });
});

test('replay: swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a rewind, a reload and a chat change equal live', async () => {
    const s = await suite({ lines: true });
    const first = await s.say(['~ npc Oren | learns: Parry — quick hands', '~ npc Oren | keepsake: + Brass key — a cellar key']);
    const base = snap(s);
    await s.swipe(['~ npc Oren | learns: Feint']);
    assert.deepEqual([abilities(s), keepsakes(s)], [['Feint'], []]);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(first, 0);
    assert.equal(snap(s), base, 'swiping back restores the first answer exactly');
    same(s, 'swipe back replay equals live');
    const second = await s.say(['~ npc Oren | learns: Riposte']);
    edit(s, second, ['~ npc Oren | learns: Riposte', '~ npc Oren | keepsake: - Brass key', '~ npc Sister Temiwa | learns: Chant']);
    await reread(s, second);
    assert.deepEqual([abilities(s, 'npc_oren'), keepsakes(s, 'npc_oren'), abilities(s, 'npc_temiwa')], [['Parry', 'Riposte'], [], ['Chant']], 'a grown Re-read');
    await reread(s, second);
    assert.deepEqual(abilities(s, 'npc_oren'), ['Parry', 'Riposte'], 'a Re-read twice writes the same');
    same(s, 'grown Re-read replay equals live');
    edit(s, second, ['~ npc Oren | learns: Disarm']);
    await reread(s, second);
    assert.deepEqual([abilities(s, 'npc_oren'), keepsakes(s, 'npc_oren'), abilities(s, 'npc_temiwa')], [['Parry', 'Disarm'], ['Brass key'], []], 'a shrunk Re-read: only the edited line stands');
    same(s, 'shrunk Re-read replay equals live');
    await s.say(['~ npc Oren | learns: Sprint']);
    await quiet(async () => { await s.host.st.deleteMessage(second); await s.host.st.deleteMessage(second - 1); });
    assert.deepEqual(abilities(s, 'npc_oren'), ['Parry', 'Sprint'], 'a middle delete keeps the later reply');
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload equals live');
    const head = s.host.store.headIndex();
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    assert.deepEqual(abilities(s, 'npc_oren'), ['Parry']);
    same(s, 'rewind replay equals live');
});

test('SFF4 #9: a line that only stores a keepsake, an ability or a Level says so in its receipt, not "nothing moved"; a swipe and a rebuild agree', async () => {
    const s = await suite({ lines: true });
    const summaries = () => s.host.store.receipts().map(item => item.receipt).filter(item => /^npc\./.test(item.type ?? '') || item.type === 'capture.npc').map(item => item.summary ?? '');
    await s.say(['~ npc Oren | keepsake: + Guild licence — granted in Auvoth']);
    assert.deepEqual(keepsakes(s), ['Guild licence']);
    assert.ok(summaries().some(text => text.includes('Oren: keepsake Guild licence added.')), JSON.stringify(summaries()));
    assert.ok(!summaries().some(text => text.includes('Oren: nothing moved')), JSON.stringify(summaries()));
    await s.swipe(['~ npc Oren | learns: Snare craft — set wire snares']);
    assert.ok(summaries().some(text => text.includes('Oren: learns Snare craft.')), JSON.stringify(summaries()));
    same(s, 'a rebuild gives the same people');
});
