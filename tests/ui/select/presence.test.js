// One presence in the new view: when Story Block's scene.present answers, it alone says who is here (chat drawer, Now, People, dossier); with no such query the store's flag and place decide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gather } from '../../../ui/select/gather.js';
import { peopleParts } from '../../../ui/select/people-parts.js';
import { selectPeople } from '../../../ui/select/people.js';
import { selectNow } from '../../../ui/select/now.js';

const LIST = [
  { id: 'a', name: 'Wiebke', present: true, location: 'Mill', meters: {} },
  { id: 'b', name: 'Sieke', present: true, location: 'Mill', meters: {} },
  { id: 'c', name: 'Pieter', present: false, location: 'Quay', meters: {} },
];
const readOf = present => (name) => ({ 'people.list': LIST, 'scene.place': { name: 'Mill' }, 'scene.present': present }[name] ?? null);
const names = list => list.map(row => row.name);

test('scene.present decides who is here, against the people store flags', () => {
  assert.deepEqual(names(gather(readOf(['Sieke', 'Pieter']), [])['npc.present']), ['Sieke', 'Pieter']);
  assert.deepEqual(names(selectNow(gather(readOf(['Sieke', 'Pieter']), ['scene.place'])).here), ['Sieke', 'Pieter']);
  const people = selectPeople(peopleParts(readOf(['Sieke', 'Pieter'])));
  assert.deepEqual(names(people.sections?.here ?? people.here), ['Sieke', 'Pieter']);
});

test('an empty scene.present means nobody is here; no scene.present query falls back to the store', () => {
  assert.deepEqual(gather(readOf([]), [])['npc.present'], []);
  assert.deepEqual(names(gather(readOf(null), [])['npc.present']), ['Wiebke', 'Sieke']);
});
