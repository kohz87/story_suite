// SFF4 on drop 3: a line about a pack person before their dossier (SFF4 #1, ./npc-lines-cast-first.test.js) goes by the same name rules as a listed person
// (SFP1 F50: the exact name or alias, else the ONE person a first name, surname or role fits; two is nobody), and on through the same rules after it (F34 a
// tie's `with:` names a known person). The receipt of a line that stored a Level, an ability or a keepsake names it (SFF4 #9); any other field only adds
// "nothing moved; … stored" (F2). Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

const ENTRY = {
    id: 'torka', name: 'Torka Vell', aliases: [], kind: 'person', role: 'frontier berserker', about: 'frontier berserker', look: 'Broad, scarred.', personality: 'Loud and loyal.',
    level: 5, abilities: [{ name: 'Blood Rage', description: 'hits harder when hurt' }], keepsakes: [{ name: 'Bone token', description: 'her father\'s' }],
    start: { goal: 'Clear the orc camps.' }, meters: { trust: 10 },
};
// A stand-in for Story Director's cast: Torka Vell, met after zz.meet; with { present: true } also while the reply's scene names her in full.
const castModule = {
    id: 'story-director', name: 'Story Director stand-in (cast)',
    features: [{ id: 'story-director.world-events', label: 'World events', describe: 'The world switch (a stand-in).', default: false }],
    domains: { zzcast: { initial: () => ({ met: false }) } },
    commands: { 'zz.meet': ctx => { ctx.draft('zzcast').met = true; return { summary: 'met' }; } },
    queries: {
        'director.cast': (state, args, tools) => {
            const met = state?.domains?.zzcast?.met === true;
            const scene = (() => { try { return tools.query('scene.present', {}); } catch { return []; } })();
            const here = (Array.isArray(scene) ? scene : []).some(name => String(name?.name ?? name).toLowerCase() === 'torka vell');
            if (!met && !(args?.present === true && here)) return [];
            return [{ key: 'ersveil:torka', pack: 'ersveil', id: 'torka', name: 'Torka Vell', aliases: [], met: met ? { on: null, where: 'Bluewatch' } : null, alive: true, entry: structuredClone(ENTRY) }];
        },
    },
};
const ASH = { npc_torka_ash: { id: 'npc_torka_ash', name: 'Torka Ash', aliases: [], present: false, memories: [], memoryStamps: {}, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } } };
const people = s => s.host.head().domains.people;
const torka = s => Object.values(people(s).npcs).find(npc => npc.name === 'Torka Vell');
const snap = s => JSON.stringify(people(s));
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const make = (records = {}, lines = true) => suite({ lines, levelOn: true, modules: [castModule], records: structuredClone(records) });
async function warned(run) {
    const seen = [];
    const original = console.warn;
    console.warn = (...args) => { seen.push(args.join(' ')); };
    try { await run(); } finally { console.warn = original; }
    return seen.join('\n');
}
const summaries = s => s.host.store.receipts().map(item => item.receipt).filter(item => /^npc\./.test(item.type ?? '') || /^capture\./.test(item.type ?? '')).map(item => item.summary ?? '');

test('a first name finds the met pack person with no dossier yet: the dossier is made under her full name, one meter entry; a first name later lands on it', async () => {
    const s = await make();
    await s.host.sdk.command('zz.meet', {});
    await s.say(['~ npc Torka | level: 9', '~ npc Torka | keepsake: + Guild licence — granted in Auvoth']);
    const record = torka(s);
    assert.ok(record, JSON.stringify(people(s).bonds.problems));
    assert.equal(record.castFrom?.key, 'ersveil:torka');
    assert.equal(String(record.level), '9');
    assert.deepEqual(record.keepsakes.map(row => row.name), ['Bone token', 'Guild licence'], 'the second line in the same reply lands on the dossier just made');
    assert.deepEqual(Object.keys(people(s).npcs), [record.id]);
    assert.deepEqual(Object.keys(people(s).bonds.npcs), [record.id], 'one meter entry, under her id');
    await s.say(['~ npc Vell | learns: Snare craft', '~ npc Torka | trust: up | impact: meaningful | why: shared a fire']);
    assert.deepEqual(torka(s).abilities.map(row => row.name), ['Blood Rage', 'Snare craft'], 'a surname the next reply');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), [record.id], 'still one meter entry');
    assert.ok(people(s).bonds.npcs[record.id].meters.trust > 10);
});

test('the reply after the meeting: the step already made her meter entry, the dossier not yet; a line by her first name makes the dossier on that entry', async () => {
    const s = await make();
    await s.host.sdk.command('zz.meet', {});
    await s.say([]);
    const entries = Object.keys(people(s).bonds.npcs);
    assert.equal(entries.length, 1, 'the step after the meeting reply made her meter entry');
    assert.equal(torka(s), undefined, 'no dossier yet (the runtime makes it after the reply)');
    const at = await s.say(['~ npc Torka | level: 9 | trust: up | impact: meaningful | why: shared a fire']);
    assert.ok(torka(s), JSON.stringify(people(s).bonds.problems));
    assert.equal(String(torka(s).level), '9');
    assert.deepEqual(Object.keys(people(s).npcs), entries, 'the dossier takes the meter entry\'s id');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), entries, 'still one meter entry');
    assert.ok(people(s).bonds.npcs[entries[0]].meters.trust > 10);
    const live = snap(s);
    same(s, 'a rebuild');
    await s.swipe(['~ npc Torka | goal: rest']);
    assert.equal(torka(s).goal, 'rest');
    same(s, 'swipe');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back');
    edit(s, at, ['~ npc Torka | level: 9 | trust: up | impact: meaningful | why: shared a fire', '~ npc Vell | keepsake: + Rope — coiled']);
    await reread(s, at);
    assert.deepEqual(torka(s).keepsakes.map(row => row.name), ['Bone token', 'Rope'], 'grown');
    assert.deepEqual(Object.keys(people(s).npcs), entries);
    same(s, 'grown Re-read');
    edit(s, at, ['~ npc Torka | learns: Rope work']);
    await reread(s, at);
    assert.equal(String(torka(s).level), '5', 'shrunk: the pack\'s Level');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), entries);
    same(s, 'shrunk Re-read');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload');
    assert.equal(s.host.ctx.chat[at - 2].is_user, false, 'the empty reply whose step made the meter entry');
    await warned(async () => { await s.host.st.deleteMessage(at - 2); await s.host.st.deleteMessage(at - 3); });
    same(s, 'middle delete (the line reply\'s stored steps named the deleted reply\'s meter entry, so live and a rebuild both leave them out)');
    await reread(s, s.host.store.headIndex());
    assert.deepEqual(Object.keys(people(s).npcs), entries, 'a Re-read makes her dossier again, under the same id');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), entries, 'one meter entry');
    assert.deepEqual(torka(s).abilities.map(row => row.name), ['Blood Rage', 'Rope work']);
    same(s, 'Re-read after the middle delete');
    await warned(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    assert.equal(torka(s), undefined, 'rewound past the line: no dossier in the store (the runtime makes it)');
    same(s, 'rewind');
});

test('a pack dossier the reader renamed is still hers (no second one); a meter entry of someone else that a first name finds goes on as before', async () => {
    const tor = { npc_tor: { id: 'npc_tor', name: 'Tor', aliases: [], present: false, memories: [], memoryStamps: {}, castFrom: { key: 'ersveil:torka' }, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } } };
    const s = await make(tor);
    await s.host.sdk.command('zz.meet', {});
    const said = await warned(() => s.say(['~ npc Torka | level: 9']));
    assert.match(said, /Torka has no record yet/, said);
    assert.deepEqual(Object.keys(people(s).npcs), ['npc_tor'], 'no second dossier for her');
    let on = false;
    const m = await make({}, () => on);
    await m.say(['~ npc Torka | trust: up | impact: meaningful | why: a drink']);
    const entry = Object.keys(people(m).bonds.npcs);
    assert.equal(entry.length, 1, 'lines off: a meter entry for "Torka", no dossier');
    on = true;
    await m.host.sdk.command('zz.meet', {});
    await m.say(['~ npc Torka | trust: up | impact: meaningful | why: another drink']);
    assert.equal(torka(m), undefined, 'Torka Vell\'s dossier is not made from a line about the other Torka');
});

test('a first name that also fits someone with a dossier is nobody (refused, no pack dossier); the full name still makes hers', async () => {
    const s = await make(ASH);
    await s.host.sdk.command('zz.meet', {});
    const said = await warned(() => s.say(['~ npc Torka | level: 9']));
    assert.equal(torka(s), undefined);
    assert.match(said, /Torka has no record yet/);
    assert.equal(people(s).npcs.npc_torka_ash.level, undefined, 'Torka Ash is not the one either');
    const again = await warned(() => s.say(['~ npc Torka Vell | level: 9']));
    assert.ok(torka(s), again + JSON.stringify(people(s).bonds.problems));
    assert.equal(String(torka(s).level), '9');
});

test('a tie on a pack person just met goes by the tie rule (F34): an unknown with: is refused and makes no dossier', async () => {
    const s = await make();
    await s.host.sdk.command('zz.meet', {});
    const said = await warned(() => s.say(['~ tie Torka | with: Nobody Known | tag: +ally']));
    assert.match(said, /Nobody Known has no record yet/);
    assert.equal(torka(s), undefined, 'the refusal takes the whole line back, the dossier with it');
});

test('receipts: a keepsake with a goal names both; meters that moved keep their words and the keepsake follows; a goal alone says nothing moved', async () => {
    const s = await make();
    await s.host.sdk.command('zz.meet', {});
    await s.say(['~ npc Torka Vell | level: 6']);
    await s.say(['~ npc Torka Vell | keepsake: + Rope — coiled | goal: find the convoy']);
    assert.ok(summaries(s).some(text => text.includes('Torka Vell: keepsake Rope added, goal stored.')), JSON.stringify(summaries(s)));
    await s.say(['~ npc Torka Vell | keepsake: - Rope | trust: up | impact: meaningful | why: gave it away']);
    const last = summaries(s).at(-1);
    assert.match(last, /trust/, last);
    assert.match(last, /Torka Vell: keepsake Rope removed\./, last);
    assert.doesNotMatch(last, /nothing moved/, last);
    await s.say(['~ npc Torka Vell | goal: rest']);
    assert.match(summaries(s).at(-1), /Torka Vell: nothing moved; goal stored/);
    await s.say(['~ npc Torka Vell | keepsake: + Map — of the pass | look: grey cloak']);
    assert.ok(summaries(s).some(text => text.includes('Torka Vell: keepsake Map added, look stored.')), JSON.stringify(summaries(s)));
    await s.say(['~ npc Torka Vell | look: a scar over one eye']);
    assert.ok(summaries(s).some(text => text.includes('Torka Vell: nothing moved; look stored')), JSON.stringify(summaries(s)));
});

test('replay == live: swipe, swipe back, an edited Re-read grown and shrunk, a middle delete, a chat change and a rewind', async () => {
    const s = await make();
    await s.say(['+ present Torka Vell']);
    const first = await s.say(['~ npc Torka | level: 9']);
    const base = snap(s);
    assert.equal(String(torka(s).level), '9', 'present in the scene by her full name, then a first name');
    same(s, 'live equals a rebuild');
    await s.swipe(['~ npc Torka | level: 7']);
    assert.equal(String(torka(s).level), '7');
    same(s, 'swipe');
    await s.host.st.swipeTo(first, 0);
    assert.equal(snap(s), base, 'swipe back');
    edit(s, first, ['~ npc Torka | level: 9', '~ npc Vell | keepsake: + Rope — coiled']);
    await reread(s, first);
    assert.deepEqual(torka(s).keepsakes.map(row => row.name), ['Bone token', 'Rope'], 'grown');
    same(s, 'grown Re-read');
    edit(s, first, ['~ npc Torka | learns: Rope work']);
    await reread(s, first);
    assert.equal(String(torka(s).level), '5', 'shrunk: the pack\'s Level');
    assert.deepEqual(torka(s).keepsakes.map(row => row.name), ['Bone token']);
    same(s, 'shrunk Re-read');
    const second = await s.say(['~ npc Torka | goal: rest']);
    await s.say(['~ npc Torka | learns: Sprint']);
    await warned(async () => { await s.host.st.deleteMessage(second); await s.host.st.deleteMessage(second - 1); });
    assert.deepEqual(torka(s).abilities.map(row => row.name), ['Blood Rage', 'Rope work', 'Sprint'], 'a middle delete keeps the later reply');
    same(s, 'middle delete');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload');
    const head = s.host.store.headIndex();
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    assert.deepEqual(torka(s).abilities.map(row => row.name), ['Blood Rage', 'Rope work']);
    same(s, 'rewind');
});
