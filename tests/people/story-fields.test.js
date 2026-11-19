// Pack format 4, N1: the built-in story fields of a person (Level, Abilities, Keepsakes): the limits cut, empty means absent, the dossier query and the closed list carry
// them, a person without them is stored as before, and a rollback / rewind / swipe restores them like any dossier field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { BUILT_IN_LIMITS, normalizeLevel, normalizeStoryList, parsePairLines } from '../../modules/people/core/core-record-parts/built-in-fields.js';
import { FIELDS } from '../../modules/people/fields/registry.js';
import { dossierFields } from '../../modules/people/adapter/queries-dossier.js';
import { PERSON_FIELDS } from '../../modules/people/domain/person-fields.js';
import { EDITOR_FIELDS, editorShownValue, untouchedEditorFields } from '../../modules/people/dossier/dossier-edit.js';

test('Level is a whole number from 1 to 99, else absent', () => {
    for (const [given, want] of [[5, 5], ['12', 12], [' 99 ', 99], [0, null], [100, null], ['abc', null], [4.5, null], ['5th', null], [-3, null], [null, null]]) assert.equal(normalizeLevel(given), want, String(given));
    assert.equal(normalizeNpcRecord({ name: 'Mira', level: 7 }).level, 7);
    assert.equal(Object.hasOwn(normalizeNpcRecord({ name: 'Mira', level: 700 }), 'level'), false);
});

test('Abilities and Keepsakes: names 60, descriptions 200, names unique without case, 16 and 12 at most, empty is absent', () => {
    const long = 'x'.repeat(400);
    const list = normalizeStoryList([{ name: long, description: long }, { name: 'Mending', description: 'a' }, { name: 'MENDING', description: 'b' }, 'Ward — holds off blows', 'Bare'], 16);
    assert.deepEqual(list.map(item => item.name.length), [60, 7, 4, 4]);
    assert.equal(list[0].description.length, 200);
    assert.equal(list[1].description, 'a', 'the first of two names that match wins');
    assert.deepEqual(list[2], { name: 'Ward', description: 'holds off blows' });
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `Skill ${i}`, description: '' }));
    const npc = normalizeNpcRecord({ name: 'Mira', abilities: many, keepsakes: many });
    assert.equal(npc.abilities.length, BUILT_IN_LIMITS.abilities);
    assert.equal(npc.keepsakes.length, BUILT_IN_LIMITS.keepsakes);
    for (const empty of [undefined, [], [{ name: '  ' }], 'text', 5]) {
        const record = normalizeNpcRecord({ name: 'Mira', abilities: empty, keepsakes: empty });
        assert.equal(Object.hasOwn(record, 'abilities') || Object.hasOwn(record, 'keepsakes'), false);
    }
    assert.deepEqual(normalizeNpcRecord(normalizeNpcRecord({ name: 'Mira', abilities: many })).abilities, normalizeNpcRecord({ name: 'Mira', abilities: many }).abilities, 'normalizing twice changes nothing');
});

test('a person with none of the three fields is stored and returned exactly as before', () => {
    const plain = createNpcRecord('Mira');
    assert.equal(['level', 'abilities', 'keepsakes'].some(key => Object.hasOwn(normalizeNpcRecord(plain), key)), false);
    assert.equal(['level', 'abilities', 'keepsakes'].some(key => Object.hasOwn(dossierFields(normalizeNpcRecord(plain)), key)), false);
});

test('the closed list and the dossier query carry the three fields; no scan, lock or snapshot list does', () => {
    for (const key of ['level', 'abilities', 'keepsakes']) {
        assert.ok(PERSON_FIELDS.has(key), key);
        for (const property of ['text', 'evidence', 'aliasMerge', 'refreshChanged', 'editorLock', 'lock', 'snapshot', 'revertGroup', 'tracked']) assert.equal(FIELDS[key][property], undefined, `${key} has no ${property}`);
    }
    const npc = normalizeNpcRecord({ name: 'Mira', level: 4, abilities: [{ name: 'Mending', description: 'closes wounds' }], keepsakes: [{ name: 'Compass', description: '' }] });
    const out = dossierFields(npc);
    assert.equal(out.level, 4);
    assert.deepEqual(out.abilities, [{ name: 'Mending', description: 'closes wounds' }]);
    assert.deepEqual(out.keepsakes, [{ name: 'Compass', description: '' }]);
});

test('the editor shows the lines "Name — description" and parses them back; a Level control that is not drawn (RPG off) keeps the stored Level', () => {
    const npc = normalizeNpcRecord({ name: 'Mira', level: 6, abilities: [{ name: 'Mending', description: 'closes wounds' }, { name: 'Ward', description: '' }] });
    assert.equal(editorShownValue(npc, 'abilities'), 'Mending — closes wounds\nWard');
    assert.deepEqual(parsePairLines(editorShownValue(npc, 'abilities'), 16), npc.abilities);
    const controls = Object.fromEntries(Object.entries(EDITOR_FIELDS).map(([key, field]) => [`people_edit_${field.id}`, editorShownValue(npc, key)]));
    assert.equal(untouchedEditorFields(npc, id => controls[id]).size, Object.keys(EDITOR_FIELDS).length, 'every control showing the stored value is untouched');
    const missing = id => (id === 'people_edit_level' ? '' : controls[id]);
    assert.equal(untouchedEditorFields(npc, missing).has('level'), false, 'with RPG on an emptied Level is a change');
    assert.equal(untouchedEditorFields(npc, missing, { rpgOn: false }).has('level'), true, 'with RPG off the Level control is not there, so the stored Level stays');
    const edited = { ...controls, people_edit_abilities: 'Mending — closes wounds' };
    assert.equal(untouchedEditorFields(npc, id => edited[id]).has('abilities'), false);
});
