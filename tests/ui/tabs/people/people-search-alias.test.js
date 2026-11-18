// F35: the People search also finds a person by an alias (a name the story gave them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPeople } from '../../../../ui/tabs/people/people.js';
import { selectPeople as shape } from '../../../../ui/select/people.js';

test('search finds an alias, and the view-model carries the aliases', () => {
  const vm = shape({ list: [{ id: 'wenna', name: 'Wenna Coll', aliases: ['Old Wen'], role: 'ferrywoman' }], place: 'Stray Oar', present: ['Wenna Coll'] });
  assert.deepEqual(vm.here[0].aliases, ['Old Wen']);
  assert.deepEqual(selectPeople(vm, 'all', 'old wen').sections[0].people.map(x => x.p.personId), ['wenna']);
  assert.equal(selectPeople(vm, 'all', 'nobody').sections[0].people.length, 0);
});

// F9: someone the scene has here but NPC State has no record of is named, not left out silently.
test('a person present with no record is named under the lists', () => {
  const vm = shape({ list: [{ id: 'wenna', name: 'Wenna Coll', aliases: ['Old Wen'] }], place: 'Stray Oar', present: ['Wenna Coll', 'Ilka Sorn'] });
  assert.deepEqual(vm.unrecorded, ['Ilka Sorn']);
  assert.equal(shape({ list: [{ id: 'wenna', name: 'Wenna Coll', aliases: ['Old Wen'] }], present: ['old wen'] }).unrecorded, undefined);
});
