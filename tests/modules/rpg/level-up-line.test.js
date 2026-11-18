// A won fight's award says the level it raised; the reply's changes then list the join and the level-up lines from the receipts' own data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { raisedLevel } from '../../../modules/rpg/fight-parts/level-up.js';
import { replyChanges } from '../../../modules/scene/domains/core/reply-changes.js';

const asked = receipts => replyChanges({}, { index: 3 }, { receipts: () => receipts.map(receipt => ({ index: 3, receipt })) }, () => 3);

test('raisedLevel names the new level and the points, and nothing when the level did not rise', () => {
  assert.deepEqual(raisedLevel({ level: 2, points: 0 }, { level: 3, points: 1 }), { to: 3, points: 1 });
  assert.deepEqual(raisedLevel({ level: 2, points: 1 }, { level: 3, points: 1 }), { to: 3 });
  assert.equal(raisedLevel({ level: 2, points: 0 }, { level: 2, points: 0 }), null);
  assert.equal(raisedLevel({}, { level: 2 }), null);
});

test('reply.changes lists a join and a level-up from the receipts', () => {
  const join = { id: 'a', type: 'dm.join', data: { join: { op: 'added', name: 'Pell' } } };
  const fight = { id: 'b', type: 'rpg.fight', data: { v2: { result: { fight: { awards: [{ who: 'Astra', xp: 20, up: { to: 3, points: 1 } }, { who: 'Pell', xp: 13 }] } } } } };
  assert.deepEqual(asked([join]).lines.map(row => row.line), ['Pell joined the party']);
  assert.deepEqual(asked([fight]).lines.map(row => row.line), ['Astra reached Lv 3 (+1 point)']);
  assert.equal(asked([{ id: 'c', type: 'rpg.fight', data: { v2: { result: { fight: { awards: [{ who: 'Pell', xp: 5 }] } } } } }]).lines.length, 0);
});
