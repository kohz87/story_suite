// Pack format 4, N2: the world cast entry seeds the person record (spec 5.2): the new names, the built-in Level, Abilities and
// Keepsakes, ties and key relationships by name, and the tastes shape. The legacy names (about, fields) are no longer read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { applyCastEntry, normalizeCast, normalizeEntry } from '../../modules/people/dossier/cast-dossier.js';
import { seedNotes } from '../../modules/people/notes/npc-notes-kinds.js';
import { readTastes } from '../../modules/people/notes/npc-notes-tastes.js';
import { readTies } from '../../modules/people/notes/npc-notes-ties.js';

// The cast sync module reads the host's stubs when it loads; a bare mock is enough for its pure seed functions.
globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { rememberCastAdmissions, seedCastAdmission } = await import('../../modules/people/runtime/runtime-cast-sync.js');

const WORLD = {
    kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Ferrywoman', species: 'Elf', gender: 'female', age: 300, apparentAge: '35',
    look: 'Tall.', wears: 'A grey coat.', forms: [{ name: 'Storm', look: 'Hair wild, eyes pale.' }], homeBase: 'Bluewatch', status: 'Grieving',
    goal: 'Top goal', start: { place: 'The docks', goal: 'Start goal', routine: 'evenings' }, level: 7,
    abilities: [{ name: 'Weirsight', description: 'Reads water.' }, { name: 'weirsight', description: 'duplicate' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }],
    keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }, { id: 'nobody', text: 'unknown id' }],
    ties: [{ with: 'orrin', tag: 'kin' }, { with: 'orrin', tag: 'owes' }, { with: 'sera', tag: 'friend' }],
    tastes: [{ item: 'strong tea', like: true, why: 'warms her' }, { item: 'crowds', like: false, why: 'too loud' }],
};
// Story Director's answer as it is sent: met people only (an unmet person never leaves Story Director), each with their entry.
const row = (id, name, extra = {}) => ({ key: `ersveil:${id}`, pack: 'ersveil', id, name, aliases: [], met: { on: 0, where: '' }, alive: true, entry: { kind: 'figure', id, name }, ...extra });
const answer = () => [row('fenna', 'Fenna', { met: { on: 0, where: 'The quay' }, entry: structuredClone(WORLD) }), row('orrin', 'Orrin'), row('sera', 'Sera')];
const made = (entry = WORLD, options = {}) => {
    const [p] = normalizeCast(answer().map(r => (r.id === 'fenna' ? { ...r, entry: structuredClone(entry) } : r)));
    return { p, npc: normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil', ...options })) };
};

test('the world cast fields seed the record under the new names', () => {
    const { npc } = made();
    assert.deepEqual([npc.role, npc.species, npc.gender, npc.age, npc.apparentAge, npc.homeBase, npc.status], ['Ferrywoman', 'Elf', 'female', '300', '~35', 'Bluewatch', 'Grieving']);
    assert.equal(npc.goal, 'Top goal', 'the top-level goal wins over start.goal');
    assert.equal(npc.location, 'The quay', 'the place the person was met at; start.place only when there is none');
    assert.deepEqual(npc.appearanceForms.map(form => form.name), ['Storm']);
    assert.equal(npc.castFrom.routine, 'evenings');
    assert.equal(made({ ...WORLD, goal: undefined }).npc.goal, 'Start goal');
});

test('Level, Abilities and Keepsakes seed as built-in fields; a figure without Level seeds none', () => {
    const { npc } = made();
    assert.equal(npc.level, 7);
    assert.deepEqual(npc.abilities, [{ name: 'Weirsight', description: 'Reads water.' }], 'names are unique without regard to case');
    assert.deepEqual(npc.keepsakes, [{ name: 'Oar', description: 'Her father\'s.' }]);
    const figure = made({ ...WORLD, level: undefined, abilities: undefined, keepsakes: undefined }).npc;
    assert.equal(Object.hasOwn(figure, 'level') && figure.level !== null, false, 'no guessed number');
    assert.ok(!figure.abilities?.length && !figure.keepsakes?.length);
});

test('abilities and keepsakes over NPC State\'s limits are left out and counted for the Problems list', () => {
    const many = n => Array.from({ length: n }, (_, i) => ({ name: `N${i}`, description: 'd' }));
    const entry = normalizeEntry({ ...WORLD, abilities: many(20), keepsakes: many(15) });
    assert.equal(entry.abilities.length, 16);
    assert.equal(entry.keepsakes.length, 12);
    assert.deepEqual(entry.overflow, { abilities: ['N16', 'N17', 'N18', 'N19'], keepsakes: ['N12', 'N13', 'N14'] });
    assert.equal(normalizeEntry(WORLD).overflow, undefined);
});

test('key relationships and ties name the met people by their cast id; an id nobody met is kept by id only, never by name', () => {
    const { p, npc } = made();
    assert.deepEqual(npc.keyRelationships, ['Orrin — her late husband\'s brother']);
    assert.deepEqual(npc.castFrom.links, { keyRelationships: [{ id: 'nobody', text: 'unknown id' }], ties: [] });
    assert.deepEqual(p.entry.ties, [{ name: 'Orrin', tag: 'kin' }, { name: 'Orrin', tag: 'owes' }, { name: 'Sera', tag: 'friend' }]);
    const ties = readTies(seedNotes(p.entry).ties);
    assert.deepEqual(ties, { orrin: ['kin', 'owes'], sera: ['friend'] });
});

test('tastes: like true is a positive sign and why is the source (the shape is fixed)', () => {
    const { p } = made();
    assert.deepEqual(p.entry.tastes, [{ sign: '+', item: 'strong tea', from: 'warms her' }, { sign: '-', item: 'crowds', from: 'too loud' }]);
    const rows = readTastes(seedNotes(p.entry).tastes);
    assert.deepEqual(rows.map(r => [r.sign, r.item, r.from]), [['+', 'strong tea', 'warms her'], ['-', 'crowds', 'too loud']]);
    assert.deepEqual(normalizeEntry({ ...WORLD, tastes: [{ sign: '+', item: 'old shape', from: 'x' }] }).tastes, [], 'the legacy sign/from shape is not read');
});

test('a format 4 entry (it has a kind) does not read the format 3 names; an entry without a kind still does, until X1', () => {
    const v4 = normalizeEntry({ kind: 'figure', id: 'x', name: 'X', about: 'old role', fields: { Class: 'Smith' }, start: { place: 'The mill' } });
    assert.deepEqual([v4.role, v4.homeBase, v4.fields], ['', '', {}]);
    const npc = applyCastEntry(createNpcRecord('X', []), { key: 'a:x', pack: 'a', id: 'x', entry: v4 }, {});
    assert.ok(!npc.role && !npc.customFields && !npc.homeBase);
    const v3 = normalizeEntry({ id: 'x', name: 'X', about: 'old role', fields: { Class: 'Smith', People: 'Elf woman, 30' }, start: { place: 'The mill' } });
    const old = applyCastEntry(createNpcRecord('X', []), { key: 'a:x', pack: 'a', id: 'x', entry: v3 }, {});
    assert.deepEqual([old.role, old.homeBase, old.customFields.Class, old.species, old.gender, old.age], ['old role', 'The mill', 'Smith', 'Elf', 'female', '30']);
});

test('seeding is the same twice, and an edit made before the meeting reply wins (swipe, rewind and Re-read read the same entry)', () => {
    const one = made().npc;
    const { createdAt, updatedAt, ...a } = one;
    const { createdAt: c, updatedAt: u, ...b } = made().npc;
    assert.deepEqual(a, b, 'replay == live');
    const { p } = made();
    const base = normalizeNpcRecord(createNpcRecord('Fenna', []));
    const state = { npcs: [{ ...base, id: 'n1' }] };
    rememberCastAdmissions(state, ['n1'], 5, []);
    state.npcs[0] = { ...state.npcs[0], level: 12, status: 'Edited', abilities: [{ name: 'Mine', description: '' }] };
    const seeded = seedCastAdmission(state, state.npcs[0], p, {});
    assert.deepEqual([seeded.level, seeded.status, seeded.abilities.map(r => r.name)], [12, 'Edited', ['Mine']], 'a later edit is kept');
    assert.equal(seeded.role, 'Ferrywoman', 'what nobody touched is seeded');
    assert.deepEqual(seeded.keepsakes.map(r => r.name), ['Oar']);
    assert.equal(state.castSeedPending, undefined);
});

test('without a meeting place, a format 4 entry shows its starting place by name (the host\'s pack places), never the place id', () => {
    const v4 = { ...WORLD, start: { place: 'bluewatch-village', goal: 'g' } };
    const noPlace = { met: { on: 0, where: '' } };
    const [p] = normalizeCast([row('fenna', 'Fenna', { ...noPlace, entry: structuredClone(v4) })]);
    const places = id => (id === 'bluewatch-village' ? 'Bluewatch Village' : '');
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), p, { placeName: places }).location, 'Bluewatch Village');
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), p, {}).location ?? '', '', 'no name to give: nothing, not the id');
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), p, { placeName: () => { throw new Error('x'); } }).location ?? '', '');
    const v3 = { ...v4, kind: undefined, start: { place: 'The mill' } };
    const [old] = normalizeCast([row('fenna', 'Fenna', { ...noPlace, entry: structuredClone(v3) })]);
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), old, { placeName: places }).location, 'The mill', 'format 3 wrote the place in words: as before');
});

test('an apparent age in words is kept as the pack wrote it while the field still is those words; a number still reads as ~N', () => {
    for (const words of ['looks older', 'dwarven middle age', 'older than he is']) {
        const npc = made({ ...WORLD, apparentAge: words }).npc;
        assert.equal(npc.apparentAge, words);
        assert.equal(normalizeNpcRecord(structuredClone(npc)).apparentAge, words, 'a save round trip keeps it');
        assert.equal(normalizeNpcRecord({ ...structuredClone(npc), apparentAge: 'seems older now' }).apparentAge, '', 'changed words are judged as any other');
    }
    assert.equal(made({ ...WORLD, apparentAge: 'about 25' }).npc.apparentAge, '~25');
    assert.equal(made({ ...WORLD, apparentAge: 'about 25' }).npc.castFrom.first.apparentAge, undefined, 'a readable age is not kept as words');
});
