// Builds the map card: find, region, zoom, fit, centre and tidy tools over a pan-and-pinch SVG of places, roads and the trip line; labels that would overlap wait for a closer zoom.
import { h, svgEl } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { button } from '../../kit/controls.js';
import { tripCard, tripSummary } from './trip.js';
import { labelGeom, planLabels, planRegions } from './map-labels.js';
import { fitView, openBox, zoomLimits } from './map-view.js';
import { placePulse, pulseRing } from './pulse.js';

export { fitBox } from './map-view.js';
const KIND_GLYPHS = [[/port|harbou?r/i, 'port'], [/ford|bridge|mill/i, 'ford'], [/city/i, 'city'], [/village|hamlet/i, 'village'],
  [/outpost|fort|camp/i, 'outpost'], [/tower|watch/i, 'tower'], [/ruin/i, 'ruin']];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const viewText = vb => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
const isBig = p => Boolean(p.here) || /capital|city|market/i.test(p.kind ?? '');

/** Picks the glyph name for a place kind such as "Port town" or "Ruin"; towns are the fallback. */
export function placeGlyph(kind) {
  const hit = KIND_GLYPHS.find(([re]) => re.test(String(kind ?? '')));
  return hit ? hit[1] : 'town';
}

/** Marks one place as selected (or none) on an already drawn map. */
export function markSelected(root, id) {
  for (const g of root.querySelectorAll('[data-pl]')) {
    g.classList.toggle('sel', g.dataset.pl === id);
  }
}

// A place's name beside its dot (lab = { side, dy px } from planLabels).
function nameText(p, u, lab, act) {
  const { r, fs } = labelGeom(p, u);
  const flip = lab?.side === 'l';
  return svgEl('text', { x: flip ? p.x - r - 6 * u : p.x + r + 6 * u, y: p.y + fs * 0.35 + (lab?.dy ?? 0) * u, 'text-anchor': flip ? 'end' : 'start', style: { 'font-size': `${fs}px`, 'stroke-width': `${3 * u}px` },
    ...(lab ? { class: ['pn', isBig(p) ? 'big' : null], 'aria-hidden': 'true', onClick: () => act.openPlace(p.id) } : { class: 'nm' }) }, p.name);
}

// A place: its dot, glyph and news mark; a name that waits (no lab) rides inside, shown on hover, focus or select.
function placeNode(p, u, newsIds, state, act, lab) {
  const big = isBig(p);
  const { r } = labelGeom(p, u);
  const nr = 9 * u;
  const stroked = /port|harbou?r|ford|bridge|mill/i.test(p.kind);
  const badge = newsIds.has(p.id)
    ? svgEl('g', { class: 'news' },
      svgEl('circle', { cx: p.x + r * 0.8, cy: p.y - r * 0.8, r: nr }),
      svgEl('text', { x: p.x + r * 0.8, y: p.y - r * 0.8 + nr * 0.45, 'text-anchor': 'middle', style: { 'font-size': `${nr * 1.5}px`, stroke: 'none' } }, '!'))
    : null;
  return svgEl('g', {
    class: ['pl', big ? 'big' : null, state.selected === p.id ? 'sel' : null, p.visited ? null : 'far', lab ? null : 'lh'],
    dataset: { pl: p.id },
    role: 'button',
    tabindex: 0,
    'aria-label': p.name,
    onClick: () => act.openPlace(p.id),
    onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') act.openPlace(p.id); },
  },
  svgEl('circle', { class: 'hit', cx: p.x, cy: p.y, r: Math.max(r, 24 * u), fill: 'transparent' }),
  svgEl('circle', { class: 'b', cx: p.x, cy: p.y, r }),
  svgEl('svg', { class: 'g', x: p.x - r * 0.6, y: p.y - r * 0.6, width: r * 1.2, height: r * 1.2, viewBox: '0 0 24 24', fill: 'currentColor', ...(stroked ? { stroke: 'currentColor', 'stroke-width': 2 } : {}) },
    ...(glyph(placeGlyph(p.kind))?.childNodes ?? [])),
  lab ? null : nameText(p, u, null, act),
  badge);
}

// The land and its grid: the old 0-1000 sheet, grown to hold every place (north up makes y negative).
function landBox(places) {
  const xs = [-500, 1500, ...places.map(p => p.x - 500), ...places.map(p => p.x + 500)];
  const ys = [-500, 1200, ...places.map(p => p.y - 500), ...places.map(p => p.y + 500)];
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// pick = { keep: ids whose labels must show, region: the chosen region }.
function drawSvg(world, vb, scale, state, act, pick) {
  const u = 1 / scale;
  const byId = new Map(world.places.map(p => [p.id, p]));
  const newsIds = new Set(world.news.map(n => n.placeId).filter(Boolean));
  const tripPts = (world.trip?.placeIds ?? []).map(id => byId.get(id)).filter(Boolean);
  const terrain = world.terrain ?? {};
  const { labels, boxes } = planLabels(world.places, vb, scale, pick);
  const names = planRegions(world.places, terrain.labels, vb, scale, boxes);
  const grid = [];
  const land = landBox(world.places);
  const span = k => [Math.min(0, Math.floor(Math.min(...world.places.map(p => p[k])) / 100) * 100), Math.max(1000, Math.ceil(Math.max(...world.places.map(p => p[k])) / 100) * 100)];
  const [x0, x1] = span('x');
  const [y0, y1] = span('y');
  for (let i = x0; i <= x1; i += 100) grid.push(svgEl('path', { class: 'grid', d: `M${i} ${land.y}V${land.y + land.h}` }));
  for (let i = y0; i <= y1; i += 100) grid.push(svgEl('path', { class: 'grid', d: `M${land.x} ${i}H${land.x + land.w}` }));
  return svgEl('svg', { class: 'mp', viewBox: viewText(vb), preserveAspectRatio: 'xMidYMid slice', 'aria-label': 'Map' },
    svgEl('rect', { class: 'land', x: land.x, y: land.y, width: land.w, height: land.h }),
    grid,
    terrain.sea ? svgEl('path', { class: 'sea', d: terrain.sea }) : null,
    (terrain.rivers ?? []).map(d => svgEl('path', { class: 'river', d })),
    names.map(l => svgEl('text', { class: 'rgn', x: l.x, y: l.y, 'text-anchor': 'middle', style: { 'font-size': `${l.fs}px`, ...(l.italic ? { 'font-style': 'italic', 'letter-spacing': '.2em' } : {}) } }, l.text)),
    world.routes.map(rt => {
      const a = byId.get(rt.a);
      const b = byId.get(rt.b);
      return a && b ? svgEl('path', { class: rt.kind === 'track' ? 'track' : 'road', d: `M${a.x} ${a.y}L${b.x} ${b.y}` }) : null;
    }),
    tripPts.length > 1
      ? svgEl('path', { class: ['trip', world.trip.state === 'arrived' ? 'done' : null], d: `M${tripPts.map(p => `${p.x} ${p.y}`).join('L')}`, style: { 'stroke-width': 4 } })
      : null,
    world.places.map(p => placeNode(p, u, newsIds, state, act, labels.get(p.id))),
    svgEl('g', { class: 'names' }, world.places.filter(p => labels.has(p.id)).map(p => nameText(p, u, labels.get(p.id), act))));
}

function tools(world, regions, on) {
  const select = h('select', { 'aria-label': 'Region', onChange: e => on.region(e.target.value) },
    h('option', { value: '' }, 'All regions'), regions.map(r => h('option', { value: r }, r)));
  const icon = (name, label, fn, extra) => button({ tone: 'icon', label, icon: name, onClick: fn, ...extra });
  return h('div', { class: 'mtools' },
    h('input', { class: 'psrch', placeholder: 'Find a place', 'aria-label': 'Find a place', onInput: e => on.find(e.target.value), onKeydown: e => { if (e.key === 'Enter') on.found(e.target.value); } }),
    select,
    icon('plus', 'Zoom in', () => on.zoom(0.75), { dataset: { z: 1 } }),
    icon('minus', 'Zoom out', () => on.zoom(1.33), { dataset: { z: -1 } }),
    icon('fit', 'Fit all places', on.fit, { dataset: { fit: 1 } }),
    icon('me', 'Centre on you', on.me, { disabled: !world.places.some(p => p.here), dataset: { me: 1 } }),
    icon('tidy', 'Tidy the labels', on.tidy, { dataset: { tidy: 1 } }));
}


const legendItem = (cls, text) => h('span', null, h('i', { class: cls }), text);
// With no trip card beside it, the map takes the whole width.
const mapWrap = (box, side) => h('div', { class: ['mapwrap', side ? null : 'solo'] }, box, side);
const ARROWS = { n: '↑', s: '↓', w: '←', e: '→' };

// Counts of the places a fit left out that are off the map now, one per edge; a tap fits every place.
function offMap(far, vb, all) {
  const sides = new Map();
  for (const p of far) {
    const side = p.y < vb.y ? 'n' : p.y > vb.y + vb.h ? 's' : p.x < vb.x ? 'w' : p.x > vb.x + vb.w ? 'e' : null;
    if (side) sides.set(side, (sides.get(side) ?? 0) + 1);
  }
  return [...sides].map(([side, n]) => h('button', { type: 'button', class: 'offmap', dataset: { side }, onClick: all },
    `${n} ${n === 1 ? 'place' : 'places'} off the map ${ARROWS[side]}`));
}

/** Builds the map card from a world view-model; state = { selected, center }; act = { openPlace(id) }; ctx.width is the map's width before it is measured. */
export function mapCard(world, state, act, ctx = {}) {
  const places = world.places ?? [];
  if (!places.length) return null;
  const data = { places, routes: world.routes ?? [], trip: world.trip ?? null, news: world.news ?? [], terrain: world.terrain ?? null };
  const regions = [...new Set(places.map(p => p.region).filter(Boolean))];
  const box = h('div', { class: 'mapbox', dataset: { map: 'box' } });
  const ratio = () => (box.clientWidth && box.clientHeight ? box.clientHeight / box.clientWidth : 0.7);
  const scale = vb => {
    const w = box.clientWidth || (typeof ctx.width === 'function' ? ctx.width() : ctx.width) || 0;
    return w ? w / vb.w : 0.7;
  };
  const px = () => box.clientWidth || (typeof ctx.width === 'function' ? ctx.width() : ctx.width) || 0;
  const tripIds = data.trip?.placeIds ?? [];
  const limits = zoomLimits(places);
  const view = { region: '', far: [] };   // the chosen region; places a fit left off the map (shown as counts at the edges)
  const opening = () => openBox(places, { ratio: ratio(), px: px(), limits, tripIds });
  let vb = opening();
  const centreOn = (p) => {
    const near = openBox(places, { ratio: ratio(), px: px(), limits, at: p });
    const w = Math.min(vb.w, near.w);
    vb = { x: p.x - w / 2, y: p.y - (w * ratio()) / 2, w, h: w * ratio() };
    view.far = [];
  };
  const focus = places.find(p => p.id === state.center);
  if (focus) centreOn(focus);
  state.center = null;
  const fitTo = (pts, all) => {
    const fit = fitView(pts, { ratio: ratio(), px: px(), min: limits.min, all });
    vb = fit.box;
    view.far = fit.far;
  };
  const redraw = () => {
    vb.h = vb.w * ratio();
    const here = places.find(p => p.here);
    const chips = offMap(view.far, vb, on.all);
    const W = vb.w * scale(vb);
    const H = vb.h * scale(vb);
    const avoid = chips.map(c => ({ n: { x: W / 2 - 110, y: 0, w: 220, h: 48 }, s: { x: W / 2 - 110, y: H - 48, w: 220, h: 48 }, w: { x: 0, y: H / 2 - 24, w: 200, h: 48 }, e: { x: W - 200, y: H / 2 - 24, w: 200, h: 48 } })[c.dataset.side]);
    const pick = { keep: new Set([...tripIds, state.selected].filter(Boolean)), region: view.region, avoid };
    box.replaceChildren(drawSvg(data, vb, scale(vb), state, act, pick), ...(here ? [pulseRing(here, vb, scale(vb))] : []), ...chips);
  };
  const on = {
    zoom(f) {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const w = clamp(vb.w * f, limits.min, limits.max);
      vb = { x: cx - w / 2, y: cy - (w * ratio()) / 2, w, h: w * ratio() };
      redraw();
    },
    fit() { fitTo(places.filter(p => !view.region || p.region === view.region), Boolean(view.region)); redraw(); },
    all() { fitTo(places, true); redraw(); },
    me() { const p = places.find(q => q.here); if (p) { centreOn(p); redraw(); } },
    tidy() { box.classList.toggle('tidy'); },
    region(name) { view.region = name || ''; on.fit(); },
    find(text) {
      const q = String(text).trim().toLowerCase();
      const hit = q && places.find(p => p.name.toLowerCase().includes(q));
      if (hit) { state.selected = hit.id; centreOn(hit); redraw(); }
      return hit ?? null;
    },
  };
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const svgNow = () => box.querySelector('svg.mp');
  box.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      drag = null;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, w: vb.w, cx: vb.x + vb.w / 2, cy: vb.y + vb.h / 2 };
      return;
    }
    if (e.target.closest?.('[data-pl], .offmap, .pn')) return;
    drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, s: vb.w / (box.clientWidth || 1), moved: false };
    box.setPointerCapture?.(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const w = clamp((pinch.w * pinch.d) / (Math.hypot(a.x - b.x, a.y - b.y) || 1), limits.min, limits.max);
      vb = { x: pinch.cx - w / 2, y: pinch.cy - (w * ratio()) / 2, w, h: w * ratio() };
    } else if (drag) {
      vb = { ...vb, x: drag.vx - (e.clientX - drag.x) * drag.s, y: drag.vy - (e.clientY - drag.y) * drag.s };
      drag.moved = true;
    } else return;
    svgNow()?.setAttribute('viewBox', viewText(vb));
    const ring = box.querySelector('.pulse');
    const here = places.find(p => p.here);
    if (ring && here) placePulse(ring, here, vb, scale(vb));
  });
  // A pan or pinch ends with a redraw, so the labels are chosen again for what is now in view.
  const up = (e) => {
    pointers.delete(e.pointerId);
    const panned = drag?.moved;
    drag = null;
    if (pinch && pointers.size < 2) { pinch = null; redraw(); } else if (panned) redraw();
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  redraw();
  let fitted = false;
  if (typeof globalThis.ResizeObserver === 'function') {
    new globalThis.ResizeObserver(() => {
      if (!box.clientWidth) return;
      if (!fitted && !focus) {
        fitted = true;
        vb = opening();
      }
      redraw();
    }).observe(box);
  }
  // Enter in Find: says what it found (and opens the place) or that nothing matched.
  const note = h('p', { class: 'fine find-note', role: 'status' });
  on.found = (text) => {
    const hit = on.find(text);
    note.textContent = !String(text).trim() ? '' : hit ? `Found ${hit.name}.` : `No place matches "${String(text).trim()}".`;
    if (hit) act.openPlace?.(hit.id);
  };
  return h('section', { class: 'card glass map-card', dataset: { card: 'map' } },
    tripSummary(data.trip),
    tools(data, regions, on),
    note,
    mapWrap(box, tripCard(data.trip, { side: true, rpg: ctx.rpg !== false })),
    h('div', { class: 'legend2' },
      legendItem('', 'road'), legendItem('t', 'track'),
      data.terrain?.rivers?.length ? legendItem('r', 'river') : null,
      legendItem('p', 'your trip'),
      data.news.some(n => n.placeId) ? h('span', null, h('b', { class: 'newsmark' }, '!'), ' news there') : null,
      legendItem('f', 'faded: not visited yet')));
}
