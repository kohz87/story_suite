// Pack format 4, F2: a world cast entry's ties and key relationships to someone not met yet are kept by cast id only (castFrom.links: never shown
// or injected) and named at read once that person is met (cast-links.js). Story Director's answer names the met people only, so the tests use that shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjection, createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { applyCastEntry, castLinksNamed, metCastNames, normalizeCast, withCastLinks } from '../../modules/people/dossier/cast-dossier.js';
import { peopleQueries } from '../../modules/people/domain/queries.js';
import { seedNotes } from '../../modules/people/notes/npc-notes-kinds.js';

const entry = (id, name, extra = {}) => ({ kind: 'companion', id, name, role: `${name}'s role`, personality: 'Calm.', start: { place: 'the-docks' }, ...extra });
const FENNA = entry('fenna', 'Fenna', {
    keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }, { id: 'sera', text: 'an old friend' }],
    ties: [{ with: 'orrin', tag: 'kin' }, { with: 'orrin', tag: 'owes' }, { with: 'sera', tag: 'friend' }],
});
const ORRIN = entry('orrin', 'Orrin', { keyRelationships: [{ id: 'fenna', text: 'his brother\'s widow' }], ties: [{ with: 'fenna', tag: 'kin' }] });
// Story Director's `director.cast`: met people only, each with their entry (an unmet person never leaves Story Director, not even their name).
const met = (id, name, raw, where = 'The quay') => ({ key: `ersveil:${id}`, pack: 'ersveil', id, name, aliases: [], met: { on: 0, where }, alive: true, entry: structuredClone(raw) });
const seed = (answer, key) => {
    const person = normalizeCast(answer).find(row => row.key === key);
    return { person, npc: normalizeNpcRecord({ ...applyCastEntry(createNpcRecord(person.name, []), person, { packName: 'Ersveil' }), id: `npc_${person.id}`, present: true }) };
};
const fennaAlone = () => seed([met('fenna', 'Fenna', FENNA)], 'ersveil:fenna');

test('met alone: the links to people not met yet are kept by cast id only; no name and no line of them is in the record', () => {
    const { person, npc } = fennaAlone();
    assert.deepEqual(npc.keyRelationships ?? [], []);
    assert.deepEqual(npc.castFrom.links, {
        keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }, { id: 'sera', text: 'an old friend' }],
        ties: [{ id: 'orrin', tag: 'kin' }, { id: 'orrin', tag: 'owes' }, { id: 'sera', tag: 'friend' }],
    });
    assert.equal(seedNotes(person.entry).ties, undefined, 'no ties leaf names an unmet person');
    assert.doesNotMatch(JSON.stringify(npc), /Orrin|Sera/);
});

test('everyone met at once: the links are named at seeding as before, and nothing waits', () => {
    const { npc } = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN), met('sera', 'Sera', entry('sera', 'Sera'))], 'ersveil:fenna');
    assert.deepEqual(npc.keyRelationships, ['Orrin — her late husband\'s brother', 'Sera — an old friend']);
    assert.equal(npc.castFrom.links, undefined);
});

test('read: a waiting link is named once that person has a dossier; the stored record is never changed; a rewind hides it again', () => {
    const fenna = Object.freeze(fennaAlone().npc);
    const before = JSON.stringify(fenna);
    const orrin = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN)], 'ersveil:orrin').npc;
    assert.deepEqual(withCastLinks([fenna]), [fenna], 'nobody else met: nothing added');
    const [shown] = withCastLinks([fenna, orrin]);
    assert.deepEqual(shown.keyRelationships, ['Orrin — her late husband\'s brother']);
    assert.deepEqual(castLinksNamed(fenna, metCastNames([fenna, orrin])).ties, [{ name: 'Orrin', tag: 'kin' }, { name: 'Orrin', tag: 'owes' }]);
    assert.equal(JSON.stringify(fenna), before, 'derived at read, never written');
    assert.deepEqual(withCastLinks([fenna])[0].keyRelationships ?? [], [], 'Orrin\'s dossier gone (a rewind, a delete of his meeting): hidden again');
    const renamed = withCastLinks([fenna, { ...orrin, name: 'Orrin Vael' }])[0];
    assert.deepEqual(renamed.keyRelationships, ['Orrin Vael — her late husband\'s brother'], 'the dossier\'s current name');
});

test('met one by one ends with the same links as met all at once', () => {
    const fenna = fennaAlone().npc;
    const orrin = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN)], 'ersveil:orrin').npc;
    const sera = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN), met('sera', 'Sera', entry('sera', 'Sera'))], 'ersveil:sera').npc;
    const oneByOne = withCastLinks([fenna, orrin, sera])[0].keyRelationships;
    const atOnce = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN), met('sera', 'Sera', entry('sera', 'Sera'))], 'ersveil:fenna').npc.keyRelationships;
    assert.deepEqual([...oneByOne].sort(), [...atOnce].sort());
});

test('a line the person already holds for that name is not repeated (an editor save kept it); eight lines at most', () => {
    const fenna = fennaAlone().npc;
    const orrin = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN)], 'ersveil:orrin').npc;
    const kept = { ...fenna, keyRelationships: ['Orrin — the brother she cannot stand'] };
    assert.deepEqual(withCastLinks([kept, orrin])[0].keyRelationships, ['Orrin — the brother she cannot stand']);
    const full = { ...fenna, keyRelationships: Array.from({ length: 8 }, (_, i) => `P${i} — x`) };
    assert.equal(withCastLinks([full, orrin])[0].keyRelationships.length, 8);
});

test('the narrator: no word of an unmet person in the injected dossier; the bond line once they are met', () => {
    const fenna = fennaAlone().npc;
    const orrin = { ...seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN)], 'ersveil:orrin').npc, present: false };
    const text = 'Fenna: the tide is turning.';
    const alone = buildInjection(withCastLinks([fenna]), text, 1, 3);
    assert.match(alone, /- Fenna: /);
    assert.doesNotMatch(alone, /Orrin|Sera|orrin|sera/);
    assert.match(buildInjection(withCastLinks([fenna, orrin]), text, 1, 3), /bonds: Orrin — her late husband's brother/);
});

test('people.dossier: castFrom (and so the waiting ids) never leaves; the named line does once that person is stored', () => {
    const fenna = fennaAlone().npc;
    const orrin = seed([met('fenna', 'Fenna', FENNA), met('orrin', 'Orrin', ORRIN)], 'ersveil:orrin').npc;
    const state = list => ({ domains: { people: { v: 1, order: list.map(npc => npc.id), npcs: Object.fromEntries(list.map(npc => [npc.id, structuredClone(npc)])) } } });
    const dossier = peopleQueries('people')['people.dossier'];
    const alone = dossier(state([fenna]), { name: 'Fenna' });
    assert.doesNotMatch(JSON.stringify(alone), /orrin|sera|Orrin|Sera/);
    assert.equal(alone.castFrom, undefined);
    const both = state([fenna, orrin]);
    const frozen = JSON.stringify(both);
    assert.deepEqual(dossier(both, { name: 'Fenna' }).keyRelationships, ['Orrin — her late husband\'s brother']);
    assert.equal(JSON.stringify(both), frozen, 'the query changes nothing it reads');
});
