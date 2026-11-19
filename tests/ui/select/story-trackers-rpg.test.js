import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStory } from '../../../ui/select/story.js';

const row = (module, name, role) => ({ module, packId: 'chat', pinned: true, definition: { name, scope: 'chat', ...(role ? { role } : {}), state: { a: { type: 'number', default: 1 } } } });

test("Story › Trackers leaves out the RPG's own blocks (Character, Skills, Foes)", () => {
  const setup = [row('fame', 'Fame by region'), row('pc', 'Astra', 'character'), row('sk', 'Astra skills', 'skills'), row('foes', 'Foes', 'foes')];
  const read = (name) => (name === 'dataModules.setup' ? setup : name === 'dataModules.view' ? { chat: { a: 1 } } : null);
  const out = selectStory(read);
  assert.deepEqual((out?.trackers ?? []).map(t => t.name), ['Fame by region']);
});
