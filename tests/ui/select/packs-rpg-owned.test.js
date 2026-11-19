import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPacks } from '../../../ui/select/packs.js';

const row = (module, name, role) => ({ module, name, packId: 'chat', pinned: true, definition: { name, ...(role ? { role } : {}), state: { a: {} } } });

test("the RPG's own blocks are not listed as trackers; they are named once as the RPG's", () => {
  const out = selectPacks({ list: [], setup: [row('fame', 'Fame by region'), row('pc', 'Character', 'character'), row('sk', 'Skills', 'skills'), row('foes', 'Foes', 'foes')] });
  assert.deepEqual(out.trackers.items.map(t => t.name), ['Fame by region']);
  assert.deepEqual(out.trackers.rpgOwned, ['Character', 'Skills', 'Foes']);
});

test('no RPG blocks: no rpgOwned field', () => {
  const out = selectPacks({ list: [], setup: [row('fame', 'Fame by region')] });
  assert.equal('rpgOwned' in out.trackers, false);
});
