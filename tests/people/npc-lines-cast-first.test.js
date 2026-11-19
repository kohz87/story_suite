// SFF4 #1: a `~ npc` line about a pack person met or present in the reply's scene, before NPC State made their dossier, is no longer refused ("has no
// record yet"): the dossier is made from the pack entry inside the reply's own step (with the pack's Level, abilities, keepsakes, goal and first meters),
// then the line applies to it (a higher Level, a learned ability, a keepsake, a goal, trust). An unmet person the scene does not have is still refused.
// Replay == live: a swipe, a swipe back, an edited Re-read (grown and shrunk), a middle delete and a rebuild give the same people.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { newStubs } from '../../modules/people/adapter/stub-fills.js';

const ENTRY = {
    id: 'torka', name: 'Torka', aliases: ['Bloodsong'], kind: 'person', about: 'frontier berserker', look: 'Broad, scarred, grey-green skin.', personality: 'Loud and loyal.',
    level: 5, abilities: [{ name: 'Blood Rage', description: 'hits harder when hurt' }], keepsakes: [{ name: 'Bone token', description: 'her father\'s' }],
    start: { place: 'bluewatch-village', goal: 'Clear the orc camps.' }, meters: { trust: 10 },
    secrets: [{ title: 'Her debt', text: 'She owes the Guild for her axe.', meter: 'trust', at: 20 }, { id: 'the-raid', gate: 'place:highmark-capital', text: 'She led the raid on the convoy.', title: 'The raid' }],
};
// A stand-in for Story Director's cast (the same rule as modules/cast/cast/queries.js): the met, and with { present: true } the unmet the reply's scene has.
const castModule = {
    id: 'story-director', name: 'Story Director stand-in (cast)',
    features: [{ id: 'story-director.world-events', label: 'World events', describe: 'The world switch (a stand-in).', default: false }],
    domains: { zzcast: { initial: () => ({ met: false }) } },
    commands: { 'zz.meet': ctx => { ctx.draft('zzcast').met = true; return { summary: 'met' }; } },
    queries: {
        'director.cast': (state, args, tools) => {
            const met = state?.domains?.zzcast?.met === true;
            const scene = (() => { try { return tools.query('scene.present', {}); } catch { return []; } })();
            const here = (Array.isArray(scene) ? scene : []).some(name => ['torka', 'bloodsong'].includes(String(name?.name ?? name).toLowerCase()));
            if (!met && !(args?.present === true && here)) return [];
            return [{ key: 'ersveil:torka', pack: 'ersveil', id: 'torka', name: 'Torka', aliases: ['Bloodsong'], met: met ? { on: null, where: 'Bluewatch Village' } : null, alive: true, entry: structuredClone(ENTRY) }];
        },
    },
};
const people = s => s.host.head().domains.people;
const torka = s => Object.values(people(s).npcs).find(npc => npc.name === 'Torka');
const problems = s => JSON.stringify(people(s).bonds.problems);
const snap = s => JSON.stringify(people(s));
const reread = async (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; assert.equal((await s.host.sdk.reread(at)).ok, true); };
async function warned(run) {
    const seen = [];
    const original = console.warn;
    console.warn = (...args) => { seen.push(args.join(' ')); };
    try { await run(); } finally { console.warn = original; }
    return seen.join('\n');
}
const make = (features = null) => suite({ lines: true, levelOn: true, modules: [castModule], records: {}, ...(features ? { features } : {}) });
const secrets = s => (torka(s).secrets ?? []).map(note => `${note.from}:${note.packId ?? ''}:${note.text}`);

test('a line in the reply that brings a pack person in makes their dossier from the pack, then applies (Level, ability, keepsake, goal, trust)', async () => {
    const s = await make();
    await s.say(['+ present Torka', '~ npc Torka | level: 9', '~ npc Torka | learns: Snare craft — set wire snares', '~ npc Torka | keepsake: + Guild licence — granted in Auvoth']);
    const record = torka(s);
    assert.ok(record, problems(s));
    assert.doesNotMatch(problems(s), /no record yet/);
    assert.equal(record.castFrom?.key, 'ersveil:torka', 'made from the pack entry');
    assert.equal(record.overallAppearance, 'Broad, scarred, grey-green skin.');
    assert.equal(String(record.level), '9', 'the line\'s Level over the pack\'s 5');
    assert.deepEqual(record.abilities.map(row => row.name), ['Blood Rage', 'Snare craft']);
    assert.deepEqual(record.keepsakes.map(row => row.name), ['Bone token', 'Guild licence']);
    assert.equal(record.goal, 'Clear the orc camps.');
    assert.equal(people(s).bonds.npcs[record.id].meters.trust, 10, 'the pack\'s first meters');
    await s.say(['~ npc Torka | goal: bring the convoy dead home | trust: up | impact: meaningful | why: you carried her pelts']);
    assert.equal(torka(s).goal, 'bring the convoy dead home');
    assert.ok(people(s).bonds.npcs[torka(s).id].meters.trust > 10);
});

test('a met pack person with no dossier yet (the meeting was the reply before) is made the same way; an unmet person not in the scene is refused', async () => {
    const s = await make();
    const said = await warned(() => s.say(['~ npc Torka | level: 9']));
    assert.equal(torka(s), undefined);
    assert.match(said, /Torka has no record yet/, 'unmet and not in the scene: refused, as before');
    await s.host.sdk.command('zz.meet', {});
    await s.say(['~ npc Torka | level: 12']);
    assert.equal(String(torka(s).level), '12');
});

test('replay == live: swipe, swipe back, an edited Re-read grown and shrunk, a middle delete and a rebuild', async () => {
    const s = await make();
    await s.say(['+ present Torka', '~ npc Torka | level: 9']);
    const at = s.host.store.headIndex();
    const live = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), live, 'a rebuild');
    await s.swipe(['+ present Torka']);
    // NPCPRESENT: `+ present` alone now makes her dossier from the pack in the reply's step (it was left to the runtime after the reply); the other swipe's level does not come.
    assert.equal(torka(s)?.castFrom?.key, 'ersveil:torka', 'a swipe with only + present makes her dossier from the pack in the step');
    assert.equal(String(torka(s).level), '5', 'the pack\'s Level, not the other swipe\'s');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back');
    await reread(s, at, ['+ present Torka', '~ npc Torka | level: 9', '~ npc Torka | keepsake: + Rope — coiled']);
    assert.deepEqual(torka(s).keepsakes.map(row => row.name), ['Bone token', 'Rope']);
    await reread(s, at, ['+ present Torka', '~ npc Torka | learns: Rope work']);
    assert.equal(String(torka(s).level), '5', 'shrunk: the pack\'s Level');
    assert.deepEqual(torka(s).keepsakes.map(row => row.name), ['Bone token']);
    assert.deepEqual(torka(s).abilities.map(row => row.name), ['Blood Rage', 'Rope work']);
    await reread(s, at, ['+ present Torka', '~ npc Torka | level: 9']);
    assert.equal(snap(s), live, 'the Re-read back to the first lines');
    await s.say(['~ npc Torka | learns: Snare craft']);
    await s.say([]);
    const before = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), before);
    await s.host.st.deleteMessage(s.host.store.headIndex() - 2);
    const after = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), after, 'a middle delete, then a rebuild');
    assert.equal(String(torka(s).level), '9');
});

test('an alias in the same reply lands on the person (one entry, never one under the alias); the pack\'s secrets come too, the gated one only with world events on; no fill-in is asked', async () => {
    const s = await make();
    await s.say(['+ present Torka', '~ npc Bloodsong | level: 9', '~ npc Bloodsong | trust: up | impact: meaningful | why: shared a fire']);
    assert.equal(String(torka(s).level), '9');
    assert.deepEqual(Object.keys(people(s).npcs), [torka(s).id], 'one dossier');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), [torka(s).id], 'one meter entry, under her id');
    assert.ok(people(s).bonds.npcs[torka(s).id].meters.trust > 10);
    assert.deepEqual(secrets(s), ['pack::She owes the Guild for her axe.']);
    assert.deepEqual(newStubs(Object.values(people(s).npcs), s.host.store.headIndex()), [], 'a pack person\'s dossier asks no fill-in');
    const w = await make({ 'story-director.world-events': true });
    await w.say(['+ present Torka', '~ npc Torka | level: 9']);
    assert.deepEqual(secrets(w), ['pack::She owes the Guild for her axe.', 'pack:the-raid:She led the raid on the convoy.'], 'with world events on, the gated secret as the after-reply dossier keeps it');
});
