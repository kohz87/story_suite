import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { buildLinesRules } from '../../modules/people/core/core-prompts-lines-parts/rules.js';
import { levelField } from '../../modules/people/meters/npc-lines-parts/level.js';

// N7 Level line: `~ npc Name | level: N` (lines mode, the custom Level field on) stores N on the person's Level custom field; a line never lowers it.
const withLevel = (customFields, extra = {}) => ({ ...dossiers(), npc_oren: { ...dossiers().npc_oren, customFields, ...extra } });
const dossier = (s, id = 'npc_oren') => s.host.head().domains.people.npcs[id];
const levelOf = (s, id) => dossier(s, id).customFields?.Level;
const problems = s => JSON.stringify(s.host.head().domains.people.bonds.problems);
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };

test('the teaching sentence is in the rules only while the Level field is on; off, the rules are as before', () => {
    const sentence = 'level: write it only when the story states a person\'s level outright, as a number (e.g. ~ npc Mira | level: 5); code keeps it and a line never lowers it.';
    assert.ok(buildLinesRules({ levelOn: true }).includes(`\n${sentence}\n`));
    assert.equal(buildLinesRules({ levelOn: false }), buildLinesRules());
    assert.equal(buildLinesRules({ levelOn: false }).includes('level:'), false);
});

test('a stated level is stored on the Level custom field; a higher one raises it; a lower or equal one never lowers it', async () => {
    const s = await suite({ lines: true, levelOn: true });
    await s.say(['~ npc Oren | level: 5']);
    assert.equal(levelOf(s, 'npc_oren'), '5');
    await s.say(['~ npc Oren | level: 3']);
    assert.equal(levelOf(s, 'npc_oren'), '5', 'a line never lowers it');
    assert.match(problems(s), /never lowers/);
    await s.say(['~ npc Oren | level: 5']);
    assert.equal(levelOf(s, 'npc_oren'), '5');
    await s.say(['~ npc Oren | level: 8 | trust: up']);
    assert.equal(levelOf(s, 'npc_oren'), '8');
    assert.equal(s.npc('Oren').meters.trust, 1, 'the line\'s meters still apply');
});

test('a level that is not a whole number 1 to 99 is refused with a note; the line\'s other labels still apply', async () => {
    const s = await suite({ lines: true, levelOn: true });
    for (const bad of ['high', 'Lv 5', '0', '100', '2.5', '-3', '']) {
        await s.say([`~ npc Oren | level: ${bad} | trust: up`]);
        assert.equal(dossier(s).customFields?.Level, undefined, `"${bad}" stores nothing`);
        assert.match(problems(s), /level/);
    }
    assert.ok(s.npc('Oren').meters.trust > 0, 'the line\'s meters still applied');
});

test('a rank or other words already in the field are not replaced; the Level key in any case is kept; a hand-locked custom field is not written', async () => {
    const rank = await suite({ lines: true, levelOn: true, records: withLevel({ Level: 'C-D' }) });
    await rank.say(['~ npc Oren | level: 40']);
    assert.equal(levelOf(rank, 'npc_oren'), 'C-D');
    assert.match(problems(rank), /already \\"C-D\\"/);
    const lower = await suite({ lines: true, levelOn: true, records: withLevel({ level: '12', Class: 'Rogue' }) });
    await lower.say(['~ npc Oren | level: 15']);
    assert.deepEqual(dossier(lower).customFields, { level: '15', Class: 'Rogue' });
    const locked = await suite({ lines: true, levelOn: true, records: withLevel({}, { manualProfileFields: ['customFields'] }) });
    await locked.say(['~ npc Oren | level: 15']);
    assert.equal(dossier(locked).customFields?.Level, undefined);
    assert.match(problems(locked), /locked by you/);
});

test('Level field off, or lines mode off: level is an unknown label as before (nothing is stored)', async () => {
    const off = await suite({ lines: true, levelOn: false });
    await off.say(['~ npc Oren | level: 5 | trust: up']);
    assert.equal(dossier(off).customFields?.Level, undefined);
    assert.match(problems(off), /\\"level\\" is not a meter/);
    const old = await suite({ lines: false, levelOn: true });
    const base = await suite({ lines: false, levelOn: false });
    await old.say(['~ npc Oren | level: 5 | trust: up']);
    await base.say(['~ npc Oren | level: 5 | trust: up']);
    assert.equal(dossier(old).customFields?.Level, undefined);
    const plain = x => snap(x).replace(/sw_[0-9a-f]+/g, 'sw');
    assert.equal(plain(old), plain(base), 'lines mode off: the Level switch changes nothing');
});

test('levelField: the reader\'s own cases', () => {
    assert.deepEqual(levelField({}, {}), { set: {}, problems: [] });
    assert.deepEqual(levelField({ level: '7' }, null), { set: { level: '7' }, problems: [] });
    assert.deepEqual(levelField({ level: '7' }, { customFields: { LEVEL: '7' } }), { set: {}, problems: [] });
});

test('replay: a swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a rewind, a reload and a chat change equal live', async () => {
    const s = await suite({ lines: true, levelOn: true });
    const first = await s.say(['~ npc Oren | level: 5']);
    const withFive = snap(s);
    await s.swipe(['~ npc Oren | level: 9']);
    assert.equal(levelOf(s, 'npc_oren'), '9');
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(first, 0);
    assert.equal(snap(s), withFive, 'swiping back restores the first answer exactly');
    assert.equal(levelOf(s, 'npc_oren'), '5');
    same(s, 'swipe back replay equals live');
    const second = await s.say(['~ npc Oren | level: 7']);
    edit(s, second, ['~ npc Oren | level: 7', '~ npc Sister Temiwa | trust: up | level: 11']);
    await reread(s, second);
    assert.deepEqual([levelOf(s, 'npc_oren'), levelOf(s, 'npc_temiwa')], ['7', '11'], 'a grown Re-read');
    await reread(s, second);
    assert.deepEqual([levelOf(s, 'npc_oren'), levelOf(s, 'npc_temiwa')], ['7', '11'], 'a Re-read twice writes the same');
    same(s, 'grown Re-read replay equals live');
    edit(s, second, ['~ npc Oren | level: 6']);
    await reread(s, second);
    assert.deepEqual([levelOf(s, 'npc_oren'), levelOf(s, 'npc_temiwa')], ['6', undefined], 'a shrunk Re-read: the edited line (6, above the first reply\'s 5) is what stands; Temiwa\'s level goes with the edit');
    same(s, 'shrunk Re-read replay equals live');
    const third = await s.say(['~ npc Oren | level: 12']);
    await quiet(async () => { await s.host.st.deleteMessage(second); await s.host.st.deleteMessage(second - 1); });
    assert.equal(levelOf(s, 'npc_oren'), '12', 'a middle delete keeps a later reply\'s level');
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload equals live');
    const head = s.host.store.headIndex();
    assert.ok(third >= 0);
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    assert.equal(levelOf(s, 'npc_oren'), '5');
    same(s, 'rewind replay equals live');
});
