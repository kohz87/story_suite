import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../../../ui/contract/world.js';
import { mapCard, placeGlyph, fitBox, markSelected } from '../../../../ui/tabs/world/map.js';

const make = (variant, state = { selected: null, center: null }, ctx = {}) => {
  const opened = [];
  const card = mapCard(worldFor(variant), state, { openPlace: id => opened.push(id) }, ctx);
  return { card, opened, state };
};
const viewBox = card => card.querySelector('svg.mp').getAttribute('viewBox').split(' ').map(Number);

test('world fixture variants match the World shape', () => {
  for (const v of ['default', 'fightOpen', 'empty']) assert.deepEqual(checkShape(worldFor(v), WORLD_SHAPE), [], v);
});

test('placeGlyph maps place kinds to glyph names, towns as the fallback', () => {
  assert.equal(placeGlyph('Port town'), 'port');
  assert.equal(placeGlyph('Ford and mill'), 'ford');
  assert.equal(placeGlyph('Free city'), 'city');
  assert.equal(placeGlyph('Village'), 'village');
  assert.equal(placeGlyph('Frontier outpost'), 'outpost');
  assert.equal(placeGlyph('Watchtower'), 'tower');
  assert.equal(placeGlyph('Ruin'), 'ruin');
  assert.equal(placeGlyph('Market town'), 'town');
  assert.equal(placeGlyph(undefined), 'town');
});

test('fitBox fits points with padding and the height/width ratio; no points gives the base box', () => {
  const box = fitBox([{ x: 100, y: 100 }, { x: 300, y: 200 }], 50, 0.5);
  assert.equal(box.w, 400);
  assert.equal(box.h, 200);
  assert.equal(box.x + box.w / 2, 200);
  assert.equal(box.y + box.h / 2, 150);
  assert.deepEqual(fitBox([]), { x: 0, y: 0, w: 1000, h: 700 });
  const tall = fitBox([{ x: 0, y: 0 }, { x: 10, y: 400 }], 0, 1);
  assert.equal(tall.w, 400);
  const wide = fitBox([{ x: 0, y: 0 }, { x: 600, y: 10 }], 0, 1);
  assert.equal(wide.w, 600);
});

test('map card draws every place, roads, tracks, the trip line and your marker', () => {
  installFakeDom();
  const { card } = make('default');
  assert.equal(card.dataset.card, 'map');
  assert.equal(card.querySelectorAll('[data-pl]').length, 9);
  assert.equal(card.querySelectorAll('path.road').length, 4);
  assert.equal(card.querySelectorAll('path.track').length, 4);
  assert.equal(card.querySelectorAll('path.trip').length, 1);
  assert.equal(card.querySelectorAll('.you').length, 1);
  assert.equal(card.querySelectorAll('.pl.far').length, 5);
  assert.equal(card.querySelectorAll('.news').length, 4);
  assert.ok(card.querySelectorAll('.rgn').length >= 3);
  assert.equal(card.querySelector('[data-trip="summary"]') !== null, true);
  assert.equal(card.querySelector('[data-card="trip"]') !== null, true);
  assert.equal(card.querySelector('[data-pl="bluewatch"]').getAttribute('aria-label'), 'Bluewatch');
});

test('tapping or pressing Enter on a place opens it; other keys do not', () => {
  installFakeDom();
  const { card, opened } = make('default');
  card.querySelector('[data-pl="auvoth"]').click();
  card.querySelector('[data-pl="oldweir"]').dispatch('keydown', { key: 'Enter' });
  card.querySelector('[data-pl="hollin"]').dispatch('keydown', { key: 'a' });
  assert.deepEqual(opened, ['auvoth', 'oldweir']);
});

test('a narrow map starts on the trip, a wide map on all places', () => {
  installFakeDom();
  const narrow = viewBox(make('default', undefined, { width: 390 }).card);
  const wide = viewBox(make('default', undefined, { width: 820 }).card);
  assert.ok(narrow[2] < wide[2]);
  assert.ok(narrow[0] < 300 && narrow[0] + narrow[2] > 600);
});

test('empty world gives no map card; no trip hides the summary and trip card', () => {
  installFakeDom();
  assert.equal(make('empty').card, null);
  assert.equal(mapCard({}, {}, {}), null);
  const noTrip = { ...worldFor(), trip: null };
  const card = mapCard(noTrip, { selected: null }, { openPlace() {} });
  assert.equal(card.querySelector('[data-card="trip"]'), null);
  assert.equal(card.querySelector('[data-trip="summary"]'), null);
  assert.equal(card.querySelectorAll('path.trip').length, 0);
});

test('zoom, fit, centre on you and region change the view box', () => {
  installFakeDom();
  const { card } = make('default', undefined, { width: 820 });
  const start = viewBox(card);
  card.querySelector('[data-z="1"]').click();
  const zin = viewBox(card);
  assert.ok(zin[2] < start[2]);
  card.querySelector('[data-z="-1"]').click();
  card.querySelector('[data-z="-1"]').click();
  assert.ok(viewBox(card)[2] > start[2]);
  card.querySelector('[data-me]').click();
  const me = viewBox(card);
  assert.equal(Math.round(me[0] + me[2] / 2), 600);
  card.querySelector('[data-fit]').click();
  assert.equal(viewBox(card)[2], start[2]);
  const sel = card.querySelector('select');
  sel.value = 'Harrow Coast';
  sel.dispatch('change');
  assert.ok(viewBox(card)[2] < start[2]);
  assert.equal(sel.querySelectorAll('option').length, 4);
});

test('zoom is clamped; centre on you is disabled when you are on no place', () => {
  installFakeDom();
  const { card } = make('default');
  for (let i = 0; i < 30; i += 1) card.querySelector('[data-z="1"]').click();
  assert.ok(viewBox(card)[2] >= 150);
  for (let i = 0; i < 60; i += 1) card.querySelector('[data-z="-1"]').click();
  assert.ok(viewBox(card)[2] <= 1600);
  const world = worldFor();
  world.places = world.places.map(p => ({ ...p, here: false }));
  const lost = mapCard(world, {}, { openPlace() {} });
  assert.equal(lost.querySelector('[data-me]').hasAttribute('disabled'), true);
  assert.equal(lost.querySelectorAll('.you').length, 0);
});

test('find selects and centres the first matching place; no match changes nothing', () => {
  installFakeDom();
  const { card, state } = make('default');
  const input = card.querySelector('.psrch');
  const before = viewBox(card).join();
  input.value = 'zzz';
  input.dispatch('input');
  assert.equal(viewBox(card).join(), before);
  input.value = 'wolf';
  input.dispatch('input');
  assert.equal(state.selected, 'wolfmere');
  assert.ok(card.querySelector('[data-pl="wolfmere"]').classList.contains('sel'));
  const vb = viewBox(card);
  assert.equal(Math.round(vb[0] + vb[2] / 2), 170);
});

test('tidy toggles label hiding; state.center centres once on that place', () => {
  installFakeDom();
  const { card, state } = make('default', { selected: null, center: 'auvoth' });
  const box = card.querySelector('.mapbox');
  card.querySelector('[data-tidy]').click();
  assert.ok(box.classList.contains('tidy'));
  card.querySelector('[data-tidy]').click();
  assert.equal(box.classList.contains('tidy'), false);
  assert.equal(state.center, null);
  const vb = viewBox(card);
  assert.equal(Math.round(vb[0] + vb[2] / 2), 300);
});

test('dragging pans the view and a drag that starts on a place does not', () => {
  installFakeDom();
  const { card } = make('default', undefined, { width: 820 });
  const box = card.querySelector('.mapbox');
  const start = viewBox(card);
  box.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: box });
  box.dispatch('pointermove', { pointerId: 1, clientX: 90, clientY: 100 });
  box.dispatch('pointerup', { pointerId: 1 });
  assert.notEqual(viewBox(card)[0], start[0]);
  const after = viewBox(card);
  const pin = card.querySelector('[data-pl="auvoth"]');
  pin.dispatch('pointerdown', { pointerId: 2, clientX: 50, clientY: 50 });
  box.dispatch('pointermove', { pointerId: 2, clientX: 10, clientY: 10 });
  assert.deepEqual(viewBox(card), after);
});

test('two-finger pinch zooms and redraws on release', () => {
  installFakeDom();
  const { card } = make('default', undefined, { width: 820 });
  const box = card.querySelector('.mapbox');
  const start = viewBox(card)[2];
  box.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: box });
  box.dispatch('pointerdown', { pointerId: 2, clientX: 200, clientY: 100, target: box });
  box.dispatch('pointermove', { pointerId: 2, clientX: 300, clientY: 100 });
  assert.ok(viewBox(card)[2] < start);
  box.dispatch('pointerup', { pointerId: 2 });
  box.dispatch('pointerup', { pointerId: 1 });
  assert.ok(viewBox(card)[2] < start);
});

test('markSelected moves the selected class between places and clears it', () => {
  installFakeDom();
  const { card } = make('default');
  markSelected(card, 'auvoth');
  assert.deepEqual(card.querySelectorAll('.pl.sel').map(g => g.dataset.pl), ['auvoth']);
  markSelected(card, 'hollin');
  assert.deepEqual(card.querySelectorAll('.pl.sel').map(g => g.dataset.pl), ['hollin']);
  markSelected(card, null);
  assert.equal(card.querySelectorAll('.pl.sel').length, 0);
});

test('the fight-open map shows the bridge as where you are', () => {
  installFakeDom();
  const { card } = make('fightOpen');
  assert.ok(card.querySelector('[data-pl="auvoth-bridge"]'));
  assert.equal(card.querySelector('[data-trip="summary"] b').textContent, 'Trip to Auvoth · on the road');
});
