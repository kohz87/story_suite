// B19: Today reads `director.next` as the reader may see it (shown: true), so a hidden plan's agenda is not named there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gather } from '../../../ui/select/gather.js';

test('gather asks director.next with shown: true and every other query with no arguments', () => {
  const asked = [];
  gather((name, args) => { asked.push([name, args]); return null; }, ['director.next', 'director.goal']);
  assert.deepEqual(asked.filter(([n]) => n.startsWith('director.')), [['director.next', { shown: true }], ['director.goal', {}]]);
});

test('B22: the names the scene has here that no person answers to (name or alias) come as scene.unrecorded', () => {
  const read = name => (name === 'people.list' ? [{ id: 'a', name: 'Ilka Sorn', aliases: ['Inkfinger'] }]
    : name === 'scene.present' ? ['ilka sorn', 'Inkfinger', 'Wenna Coll', 'wenna coll'] : null);
  assert.deepEqual(gather(read, [])['scene.unrecorded'], ['Wenna Coll']);
  assert.deepEqual(gather(() => null, [])['scene.unrecorded'], []);
});
