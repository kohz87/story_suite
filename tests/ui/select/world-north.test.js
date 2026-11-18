// The World tab draws north up: pack y grows north, the SVG's y grows down, so the view-model carries screen y = -pack y (unless the map says north is down).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../helpers/dom.js';
import { selectWorld } from '../../../ui/select/world.js';
import { mapCard, fitBox } from '../../../ui/tabs/world/map.js';

const pack = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const placesOf = (extra = {}) => pack.content.places.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ id: p.id ?? p.name, name: p.name, kind: p.kind ?? '', region: '', x: p.x, y: p.y, ...extra }));

test('the northmost place of the sample world pack is drawn above the southmost', () => {
  const places = placesOf();
  const north = places.reduce((a, b) => (b.y > a.y ? b : a));
  const south = places.reduce((a, b) => (b.y < a.y ? b : a));
  const drawn = selectWorld({ atlasView: { places, orient: { north: 'up', east: 'right' } } }).places;
  const [n, s] = [north, south].map(p => drawn.find(q => q.id === p.id));
  assert.ok(n.y < s.y, 'smaller screen y is higher up');
  assert.equal(n.y, -north.y || 0);
  assert.equal(n.x, north.x);
});

test('north down keeps y as it is; east left mirrors x; no orient reads as north up', () => {
  const view = { places: [{ id: 'a', name: 'A', x: 3, y: 4 }] };
  assert.deepEqual(selectWorld({ atlasView: { ...view, orient: { north: 'down', east: 'right' } } }).places[0], { ...selectWorld({ atlasView: view }).places[0], y: 4 });
  assert.equal(selectWorld({ atlasView: { ...view, orient: { north: 'up', east: 'left' } } }).places[0].x, -3);
  assert.equal(selectWorld({ atlasView: view }).places[0].y, -4);
});

test('a road is drawn between the flipped places and the land covers them all', () => {
  installFakeDom();
  const view = { places: [{ id: 'a', name: 'A', x: 0, y: 500 }, { id: 'b', name: 'B', x: 20, y: -500 }], routes: [{ from: 'a', to: 'b', kind: 'road' }] };
  const world = selectWorld({ atlasView: view });
  const card = mapCard(world, { selected: null, center: null }, { openPlace() {} });
  assert.equal(card.querySelector('path.road').getAttribute('d'), 'M0 -500L20 500');
  const land = card.querySelector('rect.land');
  assert.ok(Number(land.getAttribute('y')) <= -500 - 100, 'land reaches the north edge');
  assert.ok(Number(land.getAttribute('y')) + Number(land.getAttribute('height')) >= 500 + 100, 'land reaches the south edge');
  const box = fitBox(world.places, 90, 0.7);
  assert.ok(box.y < -500 && box.y + box.h > 500);
});
