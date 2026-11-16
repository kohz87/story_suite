import test from 'node:test';
import assert from 'node:assert/strict';
import { labelGeom, nudgeLabels } from '../../../../ui/tabs/world/label-nudge.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { fitBox } from '../../../../ui/tabs/world/map.js';

const vb = { x: 0, y: 0, w: 1000, h: 700 };
const place = (id, x, y, name = 'Place') => ({ id, x, y, name, kind: 'Village' });

test('labels that overlap nothing are not moved', () => {
  const places = [place('a', 100, 100), place('b', 600, 400), place('c', 300, 600)];
  assert.equal(nudgeLabels(places, 1, vb).size, 0);
});

test('the fixture world at its fit box has no overlaps, so its output is unchanged', () => {
  const places = worldFor('default').places;
  assert.equal(nudgeLabels(places, 1, fitBox(places)).size, 0);
});

test('a label that sits on an earlier one moves, and the earlier one stays', () => {
  const places = [place('a', 100, 100, 'Stonebridge'), place('b', 100, 104, 'Stonebridge')];
  const shifts = nudgeLabels(places, 1, vb);
  assert.equal(shifts.has('a'), false);
  assert.ok(Math.abs(shifts.get('b')) >= 13);
});

test('a moved label clears every other label, including a third one', () => {
  const places = [place('a', 100, 100, 'Stonebridge'), place('b', 100, 102, 'Stonebridge'), place('c', 100, 104, 'Stonebridge')];
  const shifts = nudgeLabels(places, 1, vb);
  const ys = places.map(p => p.y + (shifts.get(p.id) ?? 0));
  assert.equal(new Set(ys).size, 3);
  assert.ok(Math.min(Math.abs(ys[0] - ys[1]), Math.abs(ys[1] - ys[2]), Math.abs(ys[0] - ys[2])) >= 13);
});

test('labelGeom flips a label that would leave the view box', () => {
  assert.equal(labelGeom(place('a', 990, 10, 'Farwatch'), 1, vb).flip, true);
  assert.equal(labelGeom(place('a', 10, 10, 'Farwatch'), 1, vb).flip, false);
});
