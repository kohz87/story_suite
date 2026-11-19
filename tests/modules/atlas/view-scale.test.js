import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasView } from '../../../modules/atlas/atlas/map-parts/view.js';

const place = (id, x, y) => ({ id, name: id, kind: 'town', region: '', layer: '', x, y, hidden: false, discovered: true });
const world = {
  places: [place('a', 0, 0), place('b', 10, 0), place('c', 10, 10), place('d', 0, 10)],
  routes: [{ from: 'a', to: 'b', km: 125 }, { from: 'b', to: 'c', km: 125 }, { from: 'c', to: 'd', km: 125 }],
  find: () => null,
};

test('with no scale set, km per map unit is read from the roads (median km ÷ straight distance, less the road factor)', () => {
  assert.equal(atlasView(world, '', { map: {} }).kmPerUnit, 10);
});

test("the reader's own Km per map unit wins; too few measured roads falls back to the default", () => {
  assert.equal(atlasView(world, '', { map: { kmPerUnit: '3' } }).kmPerUnit, 3);
  assert.equal(atlasView({ ...world, routes: world.routes.slice(0, 2) }, '', { map: {} }).kmPerUnit, 1);
});
