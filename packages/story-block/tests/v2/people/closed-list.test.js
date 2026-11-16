// The closed list of a person's fields: sorted, and a record with a key outside it (a dropped archive field, an alias spelling) is refused whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSON_FIELDS } from '../../../src/v2/domains/people/person-fields.js';
import { validatePeople } from '../../../src/v2/domains/people/validate.js';

const view = record => ({ v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann', ...record } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} });

test('the field list is sorted', () => {
    const fields = [...PERSON_FIELDS];
    assert.deepEqual(fields, [...fields].sort());
});

test('a key outside the list is refused and names the field; a listed one is accepted', () => {
    assert.deepEqual(validatePeople(view({ apparentAgeAnchor: { age: 6, apparent: 6, result: 7 }, gender: 'female' })), []);
    for (const stray of ['archived', 'archiveReason', 'sex']) {
        const errors = validatePeople(view({ [stray]: 'x' }));
        assert.equal(errors.length, 1, stray);
        assert.match(errors[0], new RegExp(`npc_ann\\.${stray}`));
    }
});
