import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/dom.js';
import { mapCard } from '../../../../ui/tabs/world/map.js';
import { zoomLimits } from '../../../../ui/tabs/world/map-view.js';
import { planLabels } from '../../../../ui/tabs/world/map-labels.js';
import { groupPlaces, layoutGroups, panAbove, subName } from '../../../../ui/tabs/world/map-groups.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';

// The Ersveil records round Auvoth (format 4 pack units), with a few far places for the map's real spread.
const P = (id, name, kind, x, y, extra = {}) => ({ id, name, kind, region: 'Auvoth Compact', x, y, visited: false, here: false, danger: 'safe', ...extra });
const placesNow = () => [
  P('auvoth', 'Auvoth', 'city', 59, 110),
  P('auvoth-seventh-seal-terrace', 'Auvoth / Seventh Seal Terrace', 'district', 59, 110),
  P('auvoth-sealcrown', 'Auvoth / Sealcrown', 'district', 58.7, 109.9),
  P('auvoth-outer-lamps', 'Auvoth / Outer Lamps', 'district', 59, 109.5),
  P('auvoth-pale-market', 'Auvoth / Pale Market', 'district', 59.4, 109.6),
  P('auvoth-boneglass-yard', 'Auvoth / Boneglass Yard', 'district', 58.3, 109.8),
  P('auvoth-ashbell-hospice', 'Auvoth / Ashbell Hospice', 'district', 59.7, 109.8),
  P('auvoth-depths', 'Auvoth Depths', 'dungeon', 58.8, 110.2, { here: true, visited: true }),
  P('bluewatch-village', 'Bluewatch Village', 'village', 64, 110),
  P('bluewatch-village-guild-office', 'Bluewatch Village / Guild Office', 'guild office', 64, 110),
  P('shorn', 'Shorn', 'capital', 60, 150),
  P('greyvein-camp', 'Greyvein Camp', 'camp', 59, 150),
  P('south', 'Southmark', 'town', 40, 520),
  P('west', 'Westreach', 'town', -270, 300),
];
const AUVOTH_SUBS = ['auvoth-seventh-seal-terrace', 'auvoth-sealcrown', 'auvoth-outer-lamps', 'auvoth-pale-market', 'auvoth-boneglass-yard', 'auvoth-ashbell-hospice', 'auvoth-depths'];
const world = places => ({ places, routes: [{ kind: 'road', a: 'auvoth-depths', b: 'shorn' }], trip: null, news: [{ id: 'n', title: 'Seal cracked', placeId: 'auvoth-sealcrown' }], factions: [] });
const W = 1000;
const card = (state, places = placesNow()) => mapCard(world(places), state, { openPlace: () => {} }, { width: W });
const viewBox = c => c.querySelector('svg.mp').getAttribute('viewBox').split(' ').map(Number);
const nodes = c => c.querySelectorAll('g.pl').map(g => g.dataset.pl);

test('a town folds in its "Town / Ward" places and what lies on top of it; a nearby village and its own office stay apart', () => {
  const places = placesNow();
  const { parent, subs } = groupPlaces(places);
  assert.deepEqual(subs.get('auvoth').map(p => p.id), AUVOTH_SUBS);
  assert.deepEqual(subs.get('bluewatch-village').map(p => p.id), ['bluewatch-village-guild-office']);
  assert.equal(parent.get('bluewatch-village'), undefined);
  assert.equal(parent.get('greyvein-camp'), undefined, 'a camp one unit from Shorn is its own place');
  assert.equal(subs.size, 2);
  assert.equal(groupPlaces(places), groupPlaces(places), 'the same list gives the same answer');
  assert.equal(subName(places[2], places[0]), 'Sealcrown');
  assert.equal(subName(places[7], places[0]), 'Auvoth Depths');
});

test('the real Ersveil pack: every "Town / Ward" folds into its town; Bluewatch Village is not folded into Auvoth', () => {
  const pack = JSON.parse(readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url)));
  const places = pack.content.places.filter(p => !p.hidden);
  const { parent, subs } = groupPlaces(places);
  const byName = new Map(places.map(p => [p.name, p.id]));
  for (const p of places.filter(q => q.name.includes(' / '))) assert.equal(parent.get(p.id), byName.get(p.name.split(' / ')[0]), p.name);
  assert.equal(parent.get('bluewatch-village'), undefined);
  assert.equal(parent.get('auvoth-depths'), 'auvoth');
  assert.ok(subs.get('auvoth').length >= 7);
});

test('zoomed out, a town and its sub-places draw as ONE marker named with the count; its flags come up from them', () => {
  installFakeDom();
  const c = card({ selected: null, center: null });
  const ids = nodes(c);
  assert.ok(ids.includes('auvoth'));
  for (const id of AUVOTH_SUBS) assert.ok(!ids.includes(id), id);
  const g = c.querySelector('g.pl[data-pl="auvoth"]');
  assert.deepEqual(g.dataset.has.split(' '), AUVOTH_SUBS);
  assert.equal(g.getAttribute('aria-label'), 'Auvoth, 7 places here');
  assert.ok(g.classList.contains('big'), 'you are in Auvoth Depths, so the town is where you are');
  assert.ok(!g.classList.contains('far'), 'a visited sub-place makes the town visited');
  assert.ok(g.querySelector('.news'), 'news at a ward shows on the town');
  assert.ok(c.querySelectorAll('text').some(t => t.textContent === 'Auvoth · 7'));
  assert.ok(c.querySelectorAll('text').some(t => t.textContent === 'Bluewatch Village · 1'));
});

test('at the closest zoom the sub-places fan out round the town: each one tappable, apart, and labels never overlap', () => {
  const places = placesNow();
  const groups = groupPlaces(places);
  const min = zoomLimits(places).min;
  const vb = { x: 59 - min / 2, y: 110 - (min * 0.7) / 2, w: min, h: min * 0.7 };
  const scale = W / min;
  const lay = layoutGroups(places, groups, vb, scale, min);
  const fan = lay.fans.find(f => f.hub.id === 'auvoth');
  assert.deepEqual(fan.subs.map(s => s.id), AUVOTH_SUBS);
  assert.ok(fan.subs.some(s => s.name === 'Sealcrown'), 'short names under the town');
  const pts = [fan.hub, ...fan.subs].map(p => ({ x: p.x * scale, y: p.y * scale }));
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= 48, `dots ${i},${j} 48 px apart`);
  }
  const { labels, boxes } = planLabels(lay.shown, vb, scale);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) assert.ok(!hit(boxes[i], boxes[j]), 'labels overlap');
  assert.ok(AUVOTH_SUBS.filter(id => labels.has(id)).length >= 5, 'most sub-places get a name at once');
  installFakeDom();
  const c = card({ selected: null, center: 'auvoth-pale-market' });
  for (const id of ['auvoth', ...AUVOTH_SUBS]) assert.ok(nodes(c).includes(id), id);
  assert.equal(c.querySelectorAll('path.spoke').length, 8, 'seven round Auvoth, one to the Bluewatch guild office');
  assert.equal(c.querySelector('g.pl[data-pl="auvoth"]').dataset.has, undefined);
});

test('far out, a lone town stays folded however much room it has', () => {
  const places = placesNow();
  const min = zoomLimits(places).min;
  const lay = layoutGroups(places, groupPlaces(places), { x: -300, y: 0, w: min * 6, h: min * 4.2 }, W / (min * 6), min);
  assert.equal(lay.fans.length, 0);
  assert.equal(lay.alias.get('auvoth-sealcrown'), 'auvoth');
});

test('Find a sub-place: the map zooms to its town, fans it out and selects it', () => {
  installFakeDom();
  const state = { selected: null, center: null };
  const c = card(state);
  const input = c.querySelector('.psrch');
  input.value = 'sealcrown';
  input.dispatch('input');
  assert.equal(state.selected, 'auvoth-sealcrown');
  assert.equal(viewBox(c)[2], zoomLimits(placesNow()).min);
  assert.ok(c.querySelector('g.pl[data-pl="auvoth-sealcrown"]').classList.contains('sel'));
});

test('the selection mark is a thin ring a few px out from the dot, hidden until selected; no focus outline', () => {
  installFakeDom();
  const c = card({ selected: 'shorn', center: null });
  const g = c.querySelector('g.pl[data-pl="shorn"]');
  assert.ok(g.classList.contains('sel'));
  const scale = W / viewBox(c)[2];
  const gap = (Number(g.querySelector('.ring').getAttribute('r')) - Number(g.querySelector('circle.b').getAttribute('r'))) * scale;
  assert.ok(gap > 2 && gap <= 5, `ring ${gap} px out`);
  const css = readFileSync(new URL('../../../../ui/css/world.css', import.meta.url), 'utf8');
  assert.match(css, /\.mp \.pl \.ring\{display:none;fill:none;stroke:var\(--su-accent\);stroke-width:2\.5px;vector-effect:non-scaling-stroke\}/);
  assert.match(css, /\.mp :is\(\.pl,\.pl \*,\.pn\):focus\{outline:none\}/);
  const folded = card({ selected: 'auvoth-depths', center: null });
  assert.ok(folded.querySelector('g.pl[data-pl="auvoth"]').classList.contains('sel'), 'a folded sub-place marks its town');
});

test('panAbove moves a place the sheet covers to the middle of the strip above it, else leaves the map be', () => {
  const vb = { x: 0, y: 0, w: 100, h: 56 };
  const cover = { top: 300, bottom: 560, left: 0, right: 1000 };
  const next = panAbove(vb, { x: 50, y: 50 }, 10, cover, 560);
  assert.equal((50 - next.y) * 10, 150);
  assert.equal(next.x, 0);
  assert.equal(panAbove(vb, { x: 50, y: 10 }, 10, cover, 560), null, 'already above the sheet');
  assert.equal(panAbove(vb, { x: 50, y: 40 }, 10, { ...cover, left: 600 }, 560), null, 'beside a centred sheet');
  assert.equal(panAbove(vb, { x: 50, y: 50 }, 10, { ...cover, top: 40 }, 560), null, 'no room above the sheet');
});

// The fake DOM has no layout: a map 1000 x 560 px at the top and a sheet over its lower half.
function withRects(tab) {
  const box = tab.querySelector('[data-map="box"]');
  box.getBoundingClientRect = () => ({ top: 0, left: 0, right: W, bottom: 560, width: W, height: 560 });
  return box;
}

test('the town sheet lists its sub-places; one opens its own sheet with "‹ Auvoth" back; the map pans above the sheet', () => {
  installFakeDom();
  const tab = worldTab(world(placesNow()), { rpg: true, width: W, view: 'map' });
  withRects(tab);
  const proto = Object.getPrototypeOf(tab);
  const had = Object.getOwnPropertyDescriptor(proto, 'getBoundingClientRect');
  proto.getBoundingClientRect = function rect() { return this.classList?.contains('wsheet') ? { top: 280, bottom: 560, left: 0, right: W, width: W, height: 280 } : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; };
  try {
    const before = tab.querySelector('svg.mp').getAttribute('viewBox');
    tab.querySelector('g.pl[data-pl="auvoth"]').click();
    assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Auvoth');
    const subs = tab.querySelectorAll('.wsheet [data-sub]');
    assert.deepEqual(subs.map(b => b.dataset.sub), AUVOTH_SUBS);
    assert.equal(subs[1].textContent, 'Sealcrown');
    const vb = tab.querySelector('svg.mp').getAttribute('viewBox').split(' ').map(Number);
    const p = placesNow()[0];
    const sy = ((p.y - vb[1]) * W) / vb[2];
    assert.ok(sy < 280 - 28, `the town at ${sy} px sits above the sheet (map moved from ${before})`);
    subs[1].click();
    assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Sealcrown');
    assert.equal(tab.querySelectorAll('[data-sheet="place"]').length, 1);
    assert.ok(tab.querySelector('g.pl[data-pl="auvoth"]').classList.contains('sel'), 'the folded ward marks its town');
    const up = tab.querySelector('.wsheet .up');
    assert.equal(up.textContent, '‹ Auvoth');
    up.click();
    assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Auvoth');
    assert.equal(tab.querySelector('.wsheet .up'), null);
  } finally {
    if (had) Object.defineProperty(proto, 'getBoundingClientRect', had); else delete proto.getBoundingClientRect;
  }
});
