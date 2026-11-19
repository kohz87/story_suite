// Map labels: no two shown labels overlap or leave the map, the priorities hold, where you are always shows, and closer zooms show more.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { labelRank, planLabels, planRegions } from '../../../../ui/tabs/world/map-labels.js';
import { fitView, openBox } from '../../../../ui/tabs/world/map-view.js';

const pack = JSON.parse(readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const ERSVEIL = pack.content.places.map(p => ({ id: p.id, name: p.name, kind: p.kind, region: p.region, x: p.x, y: -p.y, visited: false, here: p.id === 'bluewatch-village' }));
const place = (id, x, y, extra = {}) => ({ id, name: `Place ${id}`, kind: 'site', region: 'R', x, y, visited: false, here: false, ...extra });
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const vb = { x: 0, y: 0, w: 1000, h: 700 };

function assertClean(boxes, W, H, what) {
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i];
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${what}: label ${i} inside the map`);
    for (let j = i + 1; j < boxes.length; j += 1) assert.ok(!hits(b, boxes[j]), `${what}: labels ${i} and ${j} overlap`);
  }
}

test('on the 320-place sample world no two shown labels overlap or leave the map, at every width and view', () => {
  for (const [W, H] of [[360, 400], [818, 560], [1100, 560], [1880, 560]]) {
    const ratio = H / W;
    const views = { fit: fitView(ERSVEIL, { ratio, px: W }).box, all: fitView(ERSVEIL, { ratio, px: W, all: true }).box, open: openBox(ERSVEIL, { ratio, px: W }) };
    for (const [name, view] of Object.entries(views)) {
      const { labels, boxes } = planLabels(ERSVEIL, view, W / view.w, {});
      assertClean(boxes, W, H, `${name} at ${W}`);
      assert.ok(labels.has('bluewatch-village'), `where you are shows (${name} at ${W})`);
    }
  }
});

test('the opening view labels more of the places in it than the old fit-all did', () => {
  const W = 818;
  const open = openBox(ERSVEIL, { ratio: 560 / W, px: W });
  const inView = ERSVEIL.filter(p => p.x >= open.x && p.x <= open.x + open.w && p.y >= open.y && p.y <= open.y + open.h);
  const { labels } = planLabels(ERSVEIL, open, W / open.w, {});
  assert.ok(inView.length >= 8, 'the opening view holds a neighbourhood');
  assert.ok(labels.size >= inView.length / 2, `${labels.size} of ${inView.length} labelled`);
});

test('where you are shows even in a pile of places on the same spot; the pile shows one more at most', () => {
  const pile = Array.from({ length: 40 }, (_, i) => place(`p${i}`, 500, 350, { kind: 'city' }));
  pile.push(place('me', 500, 350, { here: true }));
  const { labels, boxes } = planLabels(pile, vb, 1, {});
  assert.ok(labels.has('me'));
  assertClean(boxes, 1000, 700, 'pile');
  assert.ok(labels.size <= 11, 'the rest wait for hover or a closer zoom');
});

test('priorities: you, then the trip and the selected place, then cities, towns, the rest; visited and the chosen region first within a tier', () => {
  const keep = new Set(['t']);
  const r = p => labelRank(p, { keep, region: 'Wild' });
  assert.ok(r(place('me', 0, 0, { here: true })) < r(place('t', 0, 0)));
  assert.ok(r(place('t', 0, 0)) < r(place('c', 0, 0, { kind: 'capital', visited: true })));
  assert.ok(r(place('c', 0, 0, { kind: 'city' })) < r(place('w', 0, 0, { kind: 'town', visited: true })));
  assert.ok(r(place('w', 0, 0, { kind: 'Port town' })) < r(place('s', 0, 0, { visited: true, region: 'Wild' })));
  assert.ok(r(place('a', 0, 0, { visited: true })) < r(place('b', 0, 0)));
  assert.ok(r(place('a', 0, 0, { region: 'Wild' })) < r(place('b', 0, 0)));
  // the same spot: the city takes the first choice (right of its dot), the site the left; a third waits
  const trio = [place('site', 500, 300), place('city', 500, 302, { kind: 'city' }), place('ruin', 501, 301)];
  const { labels } = planLabels(trio, vb, 1, {});
  assert.deepEqual([labels.get('city').side, labels.get('site').side, labels.has('ruin')], ['r', 'l', false]);
  // a kept (trip) place goes before the city
  const kept = planLabels(trio, vb, 1, { keep: new Set(['ruin']) });
  assert.deepEqual([kept.labels.get('ruin').side, kept.labels.get('city').side, kept.labels.has('site')], ['r', 'l', false]);
});

test('labels flip or move to stay inside the map; a place whose label fits nowhere keeps its dot only', () => {
  const right = planLabels([place('r', 990, 300)], vb, 1, {});
  assert.equal(right.labels.get('r').side, 'l');
  const bottom = planLabels([place('b', 400, 698)], vb, 1, {});
  assert.ok(bottom.boxes[0].y + bottom.boxes[0].h <= 700);
  const off = planLabels([place('o', 1200, 300)], vb, 1, {});
  assert.equal(off.labels.size, 0, 'a place out of view has no label');
});

test('a label hidden at a far zoom shows when you zoom in on it', () => {
  const W = 818;
  const fit = fitView(ERSVEIL, { ratio: 560 / W, px: W }).box;
  const far = planLabels(ERSVEIL, fit, W / fit.w, {});
  const hidden = ERSVEIL.find(p => !far.labels.has(p.id) && p.kind === 'town');
  assert.ok(hidden, 'some town waits at the fit');
  const close = openBox(ERSVEIL, { ratio: 560 / W, px: W, at: hidden });
  assert.ok(planLabels(ERSVEIL, close, W / close.w, {}).labels.has(hidden.id));
});

test('region names show one per region, only where they touch no shown label and fit whole', () => {
  const places = [place('a', 300, 300, { region: 'North' }), place('b', 320, 320, { region: 'North' }), place('c', 700, 500, { region: 'South' })];
  const names = planRegions(places, null, vb, 1, []);
  assert.deepEqual(names.map(n => n.text).sort(), ['NORTH', 'SOUTH']);
  const blocked = planRegions(places, null, vb, 1, [{ x: 0, y: 0, w: 1000, h: 700 }]);
  assert.equal(blocked.length, 0);
  const edge = planRegions([place('e', 5, 5, { region: 'Edge of the world' })], null, vb, 1, []);
  assert.equal(edge.length, 0, 'a name that would be cut is left out');
  const own = planRegions(places, [{ text: 'the Grey Sound', x: 500, y: 600, italic: true }], vb, 1, []);
  assert.deepEqual(own.map(n => n.text), ['the Grey Sound']);
});
