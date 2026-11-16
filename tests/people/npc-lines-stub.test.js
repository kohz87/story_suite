import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { mergeScanResult, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { stubRecord } from '../../modules/people/meters/npc-lines-parts/derived.js';
import { peopleView } from '../../modules/people/view.js';

// N4: `+ npc Name | role | look` makes the person first, from the stub alone (lines mode only); the refusals; the look kept whole; replay equals live.
const people = s => s.host.head().domains.people;
const marta = s => people(s).npcs.npc_marta;
const same = (s, why) => { const live = JSON.stringify(s.host.head().domains.people); s.host.store.rebuild(); assert.equal(JSON.stringify(s.host.head().domains.people), live, why); };
// The refusals the changes card lists ("<line> was not used: why"): what the host warned while `run` ran.
async function warned(run) {
    const seen = [];
    const original = console.warn;
    console.warn = (...args) => { seen.push(args.join(' ')); };
    try { await run(); } finally { console.warn = original; }
    return seen.join('\n');
}
const LOOK = 'a grey braid pinned with a brass nib, ink-stained cuffs, and a limp from the left leg that she hides'.slice(0, 100);

test('the registered npc kind carries both heads, its grammar line is unchanged and the static text never shows + npc', async () => {
    const s = await suite();
    const kinds = s.host.registry.contexts().find(item => item.moduleId === 'npc-state-delta').kinds;
    const kind = kinds.find(item => item.kind === 'npc');
    assert.deepEqual([...kind.heads].sort(), ['+ npc', '~ npc']);
    assert.equal(kind.grammar, '~ npc Name | trust: +N | affection: -N');
    assert.ok(!/\+ npc/.test(kinds.map(item => item.grammar).join('\n')), 'no + npc teaching text');
    assert.equal(s.host.registry.refusals().length, 0, 'registers with no definition problem');
});

test('a reply with two new people makes two stubs: name, role and look as written, the derived fields by code, one meter entry each', async () => {
    const s = await suite({ lines: true });
    await s.say(['+ npc Marta | the harbour clerk | ' + LOOK, '+ npc Dov | a ferryman']);
    assert.equal(marta(s).name, 'Marta');
    assert.equal(marta(s).role, 'the harbour clerk');
    assert.equal(marta(s).appearance, LOOK);
    assert.equal(marta(s).identityKind, 'proper_name');
    assert.equal(marta(s).dossierReason, 'Named in the story.');
    assert.equal(people(s).npcs.npc_dov.appearance, '');
    assert.deepEqual(Object.keys(people(s).npcs).sort(), ['npc_dov', 'npc_marta', 'npc_oren', 'npc_temiwa']);
    assert.deepEqual(people(s).order.slice(-2), ['npc_marta', 'npc_dov']);
    assert.deepEqual(Object.keys(people(s).bonds.npcs).sort(), ['npc_dov', 'npc_marta']);
    same(s, 'rebuild equals live');
});

test('a look is stored exactly as written up to 100 characters (never the 30-character cut), past it cut with a note; a Re-read and a reload keep it', async () => {
    const s = await suite({ lines: true });
    assert.equal(LOOK.length, 100);
    await s.say([`+ npc Marta | clerk | ${LOOK}`]);
    assert.equal(marta(s).appearance, LOOK);
    await s.say([`+ npc Dov | ferryman | ${LOOK}xyz`]);
    assert.equal(people(s).npcs.npc_dov.appearance, LOOK);
    assert.match(JSON.stringify(people(s).bonds.problems), /look was cut to 100 characters/);
    // The scan's whole-view write (people.write) round-trips the stub's look.
    const view = structuredClone(people(s));
    const source = s.host.store.sourceAt(s.host.store.headIndex());
    const out = await s.host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view: Object.fromEntries(Object.entries(view).filter(([key]) => !['bonds', 'scan'].includes(key))) });
    assert.equal(out.ok, true);
    assert.equal(marta(s).appearance, LOOK);
    same(s, 'rebuild keeps the look');
});

test('+ npc for a listed person, the player or the played character is refused and makes nobody', async () => {
    const s = await suite({ lines: true, players: ['Ari', 'Nell'] });
    const before = JSON.stringify(people(s));
    const names = ['Oren', 'Sister Temiwa', 'sister   TEMIWA', 'Ari', 'nell', '{{user}}', '{{char}}'];
    const said = await warned(async () => { for (const name of names) await s.say([`+ npc ${name} | someone | tall`]); });
    assert.equal((said.match(/was not used/g) ?? []).length, names.length, 'each line is listed as not used');
    assert.match(said, /Oren is already listed/);
    assert.match(said, /Ari is the player or the character you play/);
    assert.equal(JSON.stringify(Object.keys(people(s).npcs)), JSON.stringify(Object.keys(JSON.parse(before).npcs)), 'nobody made');
    assert.equal(JSON.stringify(people(s).bonds?.npcs ?? {}), JSON.stringify(JSON.parse(before).bonds?.npcs ?? {}), 'no meter entry either');
});

test('a person made earlier in the reply is listed for the next + npc line; the same name twice makes one person', async () => {
    const s = await suite({ lines: true });
    await s.say(['+ npc Marta | clerk | a braid', '+ npc Marta | clerk again | a different braid', '~ npc Marta | trust: +1 | goal: find the ledger']);
    assert.equal(people(s).order.filter(id => id === 'npc_marta').length, 1);
    assert.equal(marta(s).role, 'clerk');
    assert.equal(marta(s).goal, 'find the ledger');
    assert.equal(s.npc('Marta').meters.trust, 1);
    same(s, 'rebuild equals live');
});

test('~ npc about someone with no record is refused with a note and writes nothing in lines mode; the old create-on-unknown stays with the switch off', async () => {
    const on = await suite({ lines: true });
    const said = await warned(() => on.say(['~ npc Newname | trust: up']));
    assert.match(said, /"~ npc Newname \| trust: up" was not used: Newname has no record yet/);
    assert.equal(people(on).npcs.npc_newname, undefined);
    assert.equal(people(on).bonds?.npcs?.npc_newname, undefined);
    const off = await suite({ lines: false });
    await off.say(['~ npc Newname | trust: +1']);
    assert.equal(off.host.head().domains.people.bonds.npcs.npc_newname.meters.trust, 1, 'a bonds entry, as on main');
});

test('a stub made from a title is promoted in place when the story gives a name: the id is kept', async () => {
    const s = await suite({ lines: true });
    await s.say(['+ npc Guild Receptionist | receptionist | a ledger under one arm']);
    const id = 'npc_guild-receptionist';
    const stub = people(s).npcs[id];
    assert.ok(stub, 'the stub is under the title\'s id');
    assert.equal(stub.identityKind, 'role_label');
    const promoted = mergeScanResult({ npcs: [structuredClone(stub)], candidates: [], turn: 4 }, { npcs: [{ id, name: 'Luna', aliases: ['Guild Receptionist'], identityKind: 'proper_name', sameIndividual: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] }, { turn: 5 });
    assert.equal(promoted.state.npcs.length, 1);
    assert.equal(promoted.state.npcs[0].id, id);
    assert.equal(promoted.state.npcs[0].name, 'Luna');
    assert.equal(s.npc('Guild Receptionist').key, id, 'its meter entry is under the same id');
});

test('a slug collision: the stub takes the next free id for the dossier AND its meter entry (one id for both)', async () => {
    const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
    const records = { npc_marta: { id: 'npc_marta', name: 'M\u00e4rta', aliases: [], present: false, relationship: { ...blank } } };
    const s = await suite({ lines: true, records });
    await s.say(['+ npc Marta | clerk | a braid']);
    const ids = Object.keys(people(s).npcs).sort();
    assert.deepEqual(ids.filter(id => id.startsWith('npc_marta')), ['npc_marta', 'npc_marta_2'], 'two people, two ids');
    assert.equal(people(s).npcs.npc_marta_2.role, 'clerk');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), ['npc_marta_2'], 'the meter entry is under the stub\'s id, not the other person\'s');
    same(s, 'rebuild equals live');
});

test('the unknown-person rule covers the lines about a person: ~ tie, ~ know, + milestone (a milestone is no stub); a person made earlier in the reply takes them', async () => {
    const s = await suite({ lines: true });
    const said = await warned(() => s.say(['~ tie Newname | with: Oren | tag: +ally', '~ know Newname | about: Oren | fact: keeps a ledger | how: saw', '+ milestone Newname \u2014 saved her brother']));
    assert.equal((said.match(/Newname has no record yet/g) ?? []).length, 3, said);
    assert.equal(people(s).bonds?.npcs?.npc_newname, undefined, 'no meter entry');
    assert.equal(people(s).npcs.npc_newname, undefined, 'no person: a milestone is not a stub');
    await s.say(['+ npc Newname | scribe | ink-stained', '~ tie Newname | with: Oren | tag: +ally']);
    assert.ok(people(s).npcs.npc_newname);
    assert.ok(people(s).bonds.npcs.npc_newname.tie ?? JSON.stringify(people(s).bonds.npcs.npc_newname).includes('ally'), 'the tie is written once the person exists');
});

test('only the people and meter entries of the reply decide: someone only in Delta\'s live list is no record (a Re-read of an earlier reply decides as it did live)', async () => {
    const s = await suite({ lines: true });
    s.delta.records.npc_ghost = { id: 'npc_ghost', name: 'Ghost', aliases: [], present: false, archived: false, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } };
    const said = await warned(() => s.say(['~ npc Ghost | trust: up']));
    assert.match(said, /Ghost has no record yet/);
    assert.equal(people(s).bonds?.npcs?.npc_ghost, undefined);
    const stub = await warned(() => s.say(['+ npc Ghost | a wraith']));
    assert.doesNotMatch(stub, /already listed/, 'the stub is judged by the reply\'s people too');
    assert.ok(people(s).npcs.npc_ghost);
});

test('switch off: a stray + npc line in the prose is taken like any change line (the head is registered whatever the switch says): a meter entry, no person', async () => {
    const s = await suite({ lines: false });
    await s.host.send('And then?', 'Marta waves.\n\n+ npc Marta | the clerk | a braid\n\nShe leaves.');
    await s.adapter.ticked();
    assert.equal(s.host.ctx.chat.at(-1).mes, 'Marta waves.\n\nShe leaves.\n\n<!-- STORY_SUITE_V2\n<Changes story>\n+ npc Marta | the clerk | a braid\n</Changes>\n-->', 'on main the line stayed in the text and nothing was taken');
    assert.deepEqual(Object.keys(people(s).bonds.npcs), ['npc_marta']);
    assert.equal(people(s).npcs.npc_marta, undefined);
});

test('the stub round trip: NPC State\'s own record normaliser and the people view keep a 60-character role and a 100-character look exactly', () => {
    const role = 'R'.repeat(60);   // (the record normaliser capitalises a first letter; length is what the 30-character cut would have changed)
    const look = 'L'.repeat(100);
    const made = stubRecord({ name: 'Marta', role, look }, 'npc_marta', undefined, 3);
    const normalised = normalizeNpcRecord(made);
    assert.equal(normalised.role, role);
    assert.equal(normalised.appearance, look);
    const viewed = peopleView({ npcs: [normalised], candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 0 });
    assert.equal(viewed.npcs.npc_marta.role, role);
    assert.equal(viewed.npcs.npc_marta.appearance, look);
});
