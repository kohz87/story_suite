// SOAK2UI 3: Needs you lists a companion's open offer (rpg.joinsOpen) until it is answered, and the row opens People.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNow } from '../../../ui/select/now.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';
import { checkShape } from '../../../ui/contract/shapes.js';

test('one open offer reads "<name> asks to join the party"; several are counted and named; none adds no row', () => {
  const one = selectNow({ 'rpg.joinsOpen': [{ name: 'Pell', soul: 1, best: 'dex' }] });
  assert.deepEqual(one.needsYou.map(row => [row.kind, row.title, row.go]), [['join', 'Pell asks to join the party', 'people']]);
  assert.deepEqual(checkShape(one, NOW_SHAPE), []);
  const two = selectNow({ 'rpg.joinsOpen': [{ name: 'Pell' }, { name: 'Ilse' }] });
  assert.deepEqual([two.needsYou[0].title, two.needsYou[0].detail], ['2 ask to join the party', 'Pell, Ilse']);
  assert.deepEqual(selectNow({ 'rpg.joinsOpen': [] }).needsYou, []);
  assert.deepEqual(selectNow({}).needsYou, []);
});
