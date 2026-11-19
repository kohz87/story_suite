// Map views: a fit leaves far-off outliers out (and counts them at the edge), the opening view is on where you are, a region fits that region.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/dom.js';
import { fitBox, fitView, openBox, zoomLimits } from '../../../../ui/tabs/world/map-view.js';
import { mapCard } from '../../../../ui/tabs/world/map.js';
import { worldFor } from '../../../../ui/fixtures/world.js';

const pack = JSON.parse(readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const ERSVEIL = pack.content.places.map(p => ({ id: p.id, name: p.name, kind: p.kind, region: p.region, x: p.x, y: -p.y, visited: false, here: p.id === 'bluewatch-village', danger: 'safe' }));
const NORTH = ['glass-howl-icefield', 'sunless-crevasse', 'crownless-glacier', 'iron-blue-tundra', 'hollow-aurora-zone'];
const within = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const viewBox = card => card.querySelector('svg.mp').getAttribute('viewBox').split(' ').map(Number);

test('a fit leaves the far north of the sample world out, so the rest is not squeezed', () => {
  const fit = fitView(ERSVEIL, { ratio: 0.68, px: 818 });
  const all = fitView(ERSVEIL, { ratio: 0.68, px: 818, all: true });
  assert.equal(fit.far.length, 7);
  for (const id of NORTH) assert.ok(fit.far.some(p => p.id === id), id);
  assert.ok(fit.box.h < all.box.h * 0.6, 'the core gets most of the map');
  for (const p of ERSVEIL) if (!fit.far.includes(p)) assert.ok(within(p, fit.box), `${p.id} in the fit`);
  for (const id of ['saltglass-harbor', 'tearlight-waterfall']) assert.ok(!fit.far.some(p => p.id === id), `${id} stays (far west / far south)`);
});

test('places with no outliers fit whole, a wide even spread keeps every place, and a few points never trim', () => {
  const fixture = worldFor('default').places;
  assert.equal(fitView(fixture, { ratio: 0.7, px: 820 }).far.length, 0);
  const even = Array.from({ length: 40 }, (_, i) => ({ x: i * 25, y: (i % 5) * 100 }));
  assert.equal(fitView(even).far.length, 0);
  const few = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5000, y: 0 }];
  assert.equal(fitView(few).far.length, 0);
  const one = fitView([{ x: 10, y: 10 }], { ratio: 0.5, px: 400, min: 60 }).box;
  assert.deepEqual([one.w, one.h, one.x + one.w / 2, one.y + one.h / 2], [60, 30, 10, 10]);
  assert.deepEqual(fitBox([]), { x: 0, y: 0, w: 1000, h: 700 });
});

test('the opening view is centred on where you are at a close zoom, and reaches a short trip', () => {
  const open = openBox(ERSVEIL, { ratio: 0.68, px: 818 });
  const here = ERSVEIL.find(p => p.here);
  assert.equal(Math.round(open.x + open.w / 2), here.x);
  assert.equal(Math.round(open.y + open.h / 2), here.y);
  assert.ok(open.w < fitView(ERSVEIL, { ratio: 0.68, px: 818 }).box.w / 4, 'not a fit of everything');
  const trip = openBox(ERSVEIL, { ratio: 0.68, px: 818, tripIds: ['bluewatch-village', 'ledgerford'] });
  assert.ok(within(ERSVEIL.find(p => p.id === 'ledgerford'), trip));
  const lost = ERSVEIL.map(p => ({ ...p, here: false }));
  const tripOnly = openBox(lost, { ratio: 0.68, px: 818, tripIds: ['bluewatch-village', 'ledgerford'] });
  assert.ok(within(lost.find(p => p.id === 'ledgerford'), tripOnly) && within(lost.find(p => p.id === 'bluewatch-village'), tripOnly));
});

test('zoom limits come from the places: close enough to part neighbours, far enough to see them all', () => {
  const { min, max } = zoomLimits(ERSVEIL);
  assert.ok(min < 150 && min >= 20);
  assert.ok(max >= fitView(ERSVEIL, { ratio: 0.68, px: 818, all: true }).box.w);
});

test('on the map card, Fit shows the far-off count at the edge and a tap on it fits every place', () => {
  installFakeDom();
  const world = { places: ERSVEIL, routes: [], trip: null, news: [], terrain: null };
  const card = mapCard(world, { selected: null, center: null }, { openPlace() {} }, { width: 818 });
  assert.equal(card.querySelector('.offmap'), null, 'no count before a fit');
  assert.ok(card.querySelector('.mapwrap').classList.contains('solo'), 'no trip card: the map takes the width');
  card.querySelector('[data-fit]').click();
  const chip = card.querySelector('.offmap');
  assert.equal(chip.textContent, '7 places off the map ↑');
  assert.equal(chip.dataset.side, 'n');
  chip.click();
  const all = viewBox(card);
  for (const p of ERSVEIL) assert.ok(within(p, { x: all[0], y: all[1], w: all[2], h: all[3] }), p.id);
  assert.equal(card.querySelector('.offmap'), null);
});

test('a region fits that region; places whose labels wait carry the lh class', () => {
  installFakeDom();
  const world = { places: ERSVEIL, routes: [], trip: null, news: [], terrain: null };
  const card = mapCard(world, { selected: null, center: null }, { openPlace() {} }, { width: 818 });
  const sel = card.querySelector('select');
  sel.value = 'wildzone-sites';
  sel.dispatch('change');
  const [x, y, w, h] = viewBox(card);
  for (const p of ERSVEIL.filter(q => q.region === 'wildzone-sites')) assert.ok(within(p, { x, y, w, h }), p.id);
  assert.ok(card.querySelectorAll('.pl.lh').length > 0);
  card.querySelector('[data-me]').click();
  assert.equal(card.querySelector('[data-pl="bluewatch-village"]').classList.contains('lh'), false, 'where you are is labelled');
});
