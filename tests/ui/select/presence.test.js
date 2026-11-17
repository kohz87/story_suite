// One presence in the new view: here = the store's flag or place OR Story Block's scene.present (names and aliases, folded), in the chat drawer, Now, People and the dossier.
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

test('scene.present adds to the store: listed people are here, and the store\'s own here people stay', () => {
  assert.deepEqual(names(gather(readOf(['Pieter']), [])['npc.present']), ['Wiebke', 'Sieke', 'Pieter']);
  assert.deepEqual(names(selectNow(gather(readOf(['Pieter']), ['scene.place'])).here), ['Wiebke', 'Sieke', 'Pieter']);
  const people = selectPeople(peopleParts(readOf(['Pieter'])));
  assert.deepEqual(names(people.here), ['Wiebke', 'Sieke', 'Pieter']);
});

test('no change block: scene.present frozen, NPC State records an arrival, shown Here', () => {
  const list = [...LIST, { id: 'd', name: 'Arrival', present: true, location: 'Quay', meters: {} }];
  const read = name => ({ 'people.list': list, 'scene.place': { name: 'Mill' }, 'scene.present': ['Sieke'] }[name] ?? null);
  assert.ok(names(gather(read, [])['npc.present']).includes('Arrival'));
  assert.ok(names(selectPeople(peopleParts(read)).here).includes('Arrival'));
});

test('an empty list removes nobody the store has here; a missing query is the store alone', () => {
  assert.deepEqual(names(gather(readOf([]), [])['npc.present']), ['Wiebke', 'Sieke']);
  assert.deepEqual(names(gather(readOf(null), [])['npc.present']), ['Wiebke', 'Sieke']);
});

test('a listed short name or alias matches the stored person (folded)', () => {
  const list = [{ id: 'n', name: 'Nelje Brandt', aliases: ['Nelje', 'The Clerk'], present: false, location: 'Quay', meters: {} }];
  const read = present => name => ({ 'people.list': list, 'scene.place': { name: 'Mill' }, 'scene.present': present }[name] ?? null);
  assert.deepEqual(names(gather(read([' the clerk ']), [])['npc.present']), ['Nelje Brandt']);
  assert.deepEqual(names(gather(read(['nelje']), [])['npc.present']), ['Nelje Brandt']);
  assert.deepEqual(gather(read(['Someone']), [])['npc.present'], []);
});
