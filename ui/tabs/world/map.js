// Builds the map card: find, region, zoom, fit, centre and tidy tools over a pan-and-pinch SVG of places, roads and the trip line.
import { h, svgEl } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { button } from '../../kit/controls.js';
import { tripCard, tripSummary } from './trip.js';

const BASE = Object.freeze({ x: 0, y: 0, w: 1000, h: 700 });
const KIND_GLYPHS = [[/port|harbou?r/i, 'port'], [/ford|bridge|mill/i, 'ford'], [/city/i, 'city'], [/village|hamlet/i, 'village'],
  [/outpost|fort|camp/i, 'outpost'], [/tower|watch/i, 'tower'], [/ruin/i, 'ruin']];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const viewText = vb => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

/** Picks the glyph name for a place kind such as "Port town" or "Ruin"; towns are the fallback. */
export function placeGlyph(kind) {
  const hit = KIND_GLYPHS.find(([re]) => re.test(String(kind ?? '')));
  return hit ? hit[1] : 'town';
}

/** Returns the view box that fits the points with padding at the given height/width ratio. */
export function fitBox(points, pad = 90, ratio = 0.7) {
  if (!points.length) return { ...BASE };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) / ratio);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * ratio) / 2, w, h: w * ratio };
}

/** Marks one place as selected (or none) on an already drawn map. */
export function markSelected(root, id) {
  for (const g of root.querySelectorAll('[data-pl]')) {
    g.classList.toggle('sel', g.dataset.pl === id);
  }
}

function regionLabels(places) {
  const groups = new Map();
  for (const p of places) {
    if (!p.region) continue;
    if (!groups.has(p.region)) groups.set(p.region, []);
    groups.get(p.region).push(p);
  }
  return [...groups].map(([name, list]) => svgEl('text', {
    class: 'rgn',
    x: Math.round(list.reduce((s, p) => s + p.x, 0) / list.length) - name.length * 6,
    y: Math.round(list.reduce((s, p) => s + p.y, 0) / list.length) - 60,
  }, name.toUpperCase()));
}

function placeNode(p, u, newsIds, state, act, vb) {
  const big = p.here || /city|market/i.test(p.kind);
  const r = Math.max(big ? 17 : 13, 15 * u);
  const fs = 13 * u * (big ? 1.1 : 1);
  const nr = Math.max(8, 9 * u);
  const flip = p.x + r + 6 + p.name.length * fs * 0.6 > vb.x + vb.w;
  const stroked = /port|harbou?r|ford|bridge|mill/i.test(p.kind);
  const badge = newsIds.has(p.id)
    ? svgEl('g', { class: 'news' },
      svgEl('circle', { cx: p.x + r * 0.8, cy: p.y - r * 0.8, r: nr }),
      svgEl('text', { x: p.x + r * 0.8, y: p.y - r * 0.8 + nr * 0.45, 'text-anchor': 'middle', style: { 'font-size': `${nr * 1.5}px`, stroke: 'none' } }, '!'))
    : null;
  return svgEl('g', {
    class: ['pl', big ? 'big' : null, state.selected === p.id ? 'sel' : null, p.visited ? null : 'far'],
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
  svgEl('text', { x: flip ? p.x - r - 6 : p.x + r + 6, y: p.y + fs * 0.35, 'text-anchor': flip ? 'end' : 'start', style: { 'font-size': `${fs}px`, 'stroke-width': `${3 * u}px` } }, p.name),
  badge);
}

function drawSvg(world, vb, scale, state, act) {
  const u = 1 / scale;
  const byId = new Map(world.places.map(p => [p.id, p]));
  const newsIds = new Set(world.news.map(n => n.placeId).filter(Boolean));
  const tripPts = (world.trip?.placeIds ?? []).map(id => byId.get(id)).filter(Boolean);
  const here = world.places.find(p => p.here);
  const terrain = world.terrain ?? {};
  const grid = [];
  for (let i = 0; i <= 1000; i += 100) grid.push(svgEl('path', { class: 'grid', d: `M${i} -500V1200M-500 ${i}H1500` }));
  return svgEl('svg', { class: 'mp', viewBox: viewText(vb), preserveAspectRatio: 'xMidYMid slice', 'aria-label': 'Map' },
    svgEl('rect', { class: 'land', x: -500, y: -500, width: 2000, height: 1700 }),
    grid,
    terrain.sea ? svgEl('path', { class: 'sea', d: terrain.sea }) : null,
    (terrain.rivers ?? []).map(d => svgEl('path', { class: 'river', d })),
    terrain.labels ? terrain.labels.map(l => svgEl('text', { class: 'rgn', x: l.x, y: l.y, style: l.italic ? { 'font-style': 'italic', 'letter-spacing': '.2em' } : null }, l.text)) : regionLabels(world.places),
    world.routes.map(rt => {
      const a = byId.get(rt.a);
      const b = byId.get(rt.b);
      return a && b ? svgEl('path', { class: rt.kind === 'track' ? 'track' : 'road', d: `M${a.x} ${a.y}L${b.x} ${b.y}` }) : null;
    }),
    tripPts.length > 1
      ? svgEl('path', { class: ['trip', world.trip.state === 'arrived' ? 'done' : null], d: `M${tripPts.map(p => `${p.x} ${p.y}`).join('L')}`, style: { 'stroke-width': Math.max(5, 4 * u) } })
      : null,
    world.places.map(p => placeNode(p, u, newsIds, state, act, vb)),
    here ? svgEl('g', { class: 'you' }, svgEl('circle', { class: 'r', cx: here.x, cy: here.y, r: 14 })) : null);
}

function tools(world, regions, on) {
  const select = h('select', { 'aria-label': 'Region', onChange: e => on.region(e.target.value) },
    h('option', { value: '' }, 'All regions'), regions.map(r => h('option', { value: r }, r)));
  const icon = (name, label, fn, extra) => button({ tone: 'icon', label, icon: name, onClick: fn, ...extra });
  return h('div', { class: 'mtools' },
    h('input', { class: 'psrch', placeholder: 'Find a place', 'aria-label': 'Find a place', onInput: e => on.find(e.target.value) }),
    select,
    icon('plus', 'Zoom in', () => on.zoom(0.75), { dataset: { z: 1 } }),
    icon('minus', 'Zoom out', () => on.zoom(1.33), { dataset: { z: -1 } }),
    icon('fit', 'Fit all places', on.fit, { dataset: { fit: 1 } }),
    icon('me', 'Centre on you', on.me, { disabled: !world.places.some(p => p.here), dataset: { me: 1 } }),
    icon('tidy', 'Tidy the labels', on.tidy, { dataset: { tidy: 1 } }));
}


const legendItem = (cls, text) => h('span', null, h('i', { class: cls }), text);

/** Builds the map card from a world view-model; state = { selected, center }; act = { openPlace(id) }; ctx.width picks the first fit. */
export function mapCard(world, state, act, ctx = {}) {
  const places = world.places ?? [];
  if (!places.length) return null;
  const data = { places, routes: world.routes ?? [], trip: world.trip ?? null, news: world.news ?? [], terrain: world.terrain ?? null };
  const regions = [...new Set(places.map(p => p.region).filter(Boolean))];
  const box = h('div', { class: 'mapbox', dataset: { map: 'box' } });
  const ratio = () => (box.clientWidth && box.clientHeight ? box.clientHeight / box.clientWidth : 0.7);
  const scale = vb => (box.clientWidth ? box.clientWidth / vb.w : 0.7);
  const tripPts = (data.trip?.placeIds ?? []).map(id => places.find(p => p.id === id)).filter(Boolean);
  const firstFit = () => {
    const w = box.clientWidth || (typeof ctx.width === 'function' ? ctx.width() : ctx.width) || 0;
    return w < 500 && tripPts.length > 1 ? fitBox(tripPts, 100, ratio()) : fitBox(places, 90, ratio());
  };
  let vb = firstFit();
  const centreOn = (p) => {
    const w = Math.min(vb.w, 600);
    vb = { x: p.x - w / 2, y: p.y - (w * ratio()) / 2, w, h: w * ratio() };
  };
  const focus = places.find(p => p.id === state.center);
  if (focus) centreOn(focus);
  state.center = null;
  const redraw = () => {
    vb.h = vb.w * ratio();
    box.replaceChildren(drawSvg(data, vb, scale(vb), state, act));
  };
  const on = {
    zoom(f) {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const w = clamp(vb.w * f, 150, 1600);
      vb = { x: cx - w / 2, y: cy - (w * ratio()) / 2, w, h: w * ratio() };
      redraw();
    },
    fit() { vb = fitBox(places, 90, ratio()); redraw(); },
    me() { const p = places.find(q => q.here); if (p) { centreOn(p); redraw(); } },
    tidy() { box.classList.toggle('tidy'); },
    region(name) { vb = fitBox(places.filter(p => !name || p.region === name), 90, ratio()); redraw(); },
    find(text) {
      const q = String(text).trim().toLowerCase();
      const hit = q && places.find(p => p.name.toLowerCase().includes(q));
      if (hit) { state.selected = hit.id; centreOn(hit); redraw(); }
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
    if (e.target.closest?.('[data-pl]')) return;
    drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, s: vb.w / (box.clientWidth || 1) };
    box.setPointerCapture?.(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const w = clamp((pinch.w * pinch.d) / (Math.hypot(a.x - b.x, a.y - b.y) || 1), 150, 1600);
      vb = { x: pinch.cx - w / 2, y: pinch.cy - (w * ratio()) / 2, w, h: w * ratio() };
    } else if (drag) {
      vb = { ...vb, x: drag.vx - (e.clientX - drag.x) * drag.s, y: drag.vy - (e.clientY - drag.y) * drag.s };
    } else return;
    svgNow()?.setAttribute('viewBox', viewText(vb));
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    drag = null;
    if (pinch && pointers.size < 2) { pinch = null; redraw(); }
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
        vb = firstFit();
      }
      redraw();
    }).observe(box);
  }
  return h('section', { class: 'card glass map-card', dataset: { card: 'map' } },
    tripSummary(data.trip),
    tools(data, regions, on),
    h('div', { class: 'mapwrap' }, box, tripCard(data.trip, { side: true, rpg: ctx.rpg !== false })),
    h('div', { class: 'legend2' },
      legendItem('', 'road'), legendItem('t', 'track'),
      data.terrain?.rivers?.length ? legendItem('r', 'river') : null,
      legendItem('p', 'your trip'),
      data.news.some(n => n.placeId) ? h('span', null, h('b', { class: 'newsmark' }, '!'), ' news there') : null,
      legendItem('f', 'faded: not visited yet')));
}
