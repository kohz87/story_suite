import test from 'node:test';
import assert from 'node:assert/strict';
import { selectScene } from '../../../ui/select/interaction.js';

test('selectScene: Send with this is off when the engine says no message waits', () => {
  const base = { id: 's', kindId: 'story-block/fight', title: 'Fight', state: 'staged', steps: [{}], canSend: true, canDiscard: true, view: null };
  assert.equal(selectScene(base).canSend, true);
  assert.equal(selectScene({ ...base, waiting: false }).canSend, false);
});
