// The map page (views/route.js PAGES: the "List · Map" segment of Places & routes; mock MK-3). The World tab's map pieces (fitBox,
// placeGlyph) draw the pack's places, routes, region areas (by region or by climate) and realm outlines, north up. In Select, a tap picks
// a place or a route; a place is dragged (or moved with the arrow keys or the X and Y steppers) to commit its x and y as one undo step,
// and a route can be deleted. In Add a route, a tap on two places opens the new route's form. A format 3 pack's map only looks.
//
// What must outlive a redraw (the view box, the mode, the selection, a half-made route) lives in ctx.keep('map:view').

import { h, svgEl } from '../../ui/kit/dom.js';
import { glyph } from '../../ui/kit/glyphs.js';
import { fitBox, placeGlyph } from '../../ui/tabs/world/map.js';
import { CLIMATES, PLACE_CLASSES, ROUTE_CLASSES } from '../../packs/limits.js';
import { usedBy } from '../model/refs.js';

const S = 10; // drawing units per map unit
const HUES = ['#e0a33a', '#3fb5a8', '#c77ad8', '#7cc46a', '#d9c24a', '#e0739a', '#5b8fe0', '#e2735a'];
const CLIMATE_HUE = { temperate: '#6cbf6a', cold: '#8cc4ef', frozen: '#eef3f8', highland: '#b08a66', arid: '#e3b040', warm: '#e98a55', tropical: '#2fb894', coastal: '#45b8d8', sea: '#4a6fd8', underground: '#9a83cf' };
const NO_CLIMATE = '#8a90a0';
const LEGEND = [['relay-road', 'relay road'], ['road', 'road'], ['pass', 'pass'], ['trail', 'trail'], ['river', 'river'], ['sea', 'sea'], ['none', 'other']];
const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const routeKey = route => route.name ?? `${route.from}–${route.to}`;
const classOf = (map, kind, known) => (map && typeof map[kind] === 'string' ? map[kind] : known.includes(kind) ? kind : 'none');

/** The map's data for one layer ('' is the main map): places in drawing units (y up is north), routes between drawn places, colours. */
export function mapModel(doc, layer = '') {
    const content = doc?.content ?? {};
    const regions = list(content.regions);
    const hue = new Map(regions.map((region, n) => [region.id, HUES[n % HUES.length]]));
    const climateOf = new Map(regions.map(region => [region.id, region.climate]));
    const all = list(content.places).map((place, at) => ({ place, at })).filter(({ place }) => finite(place.x) && finite(place.y));
    const layers = new Map();
    for (const { place } of all) layers.set(place.layer ?? '', (layers.get(place.layer ?? '') ?? 0) + 1);
    const places = all.filter(({ place }) => (place.layer ?? '') === layer).map(({ place, at }) => ({ at, raw: place, id: place.id, name: String(place.name ?? place.id ?? `#${at + 1}`),
        kind: place.kind, region: place.region, hidden: place.hidden === true, x: place.x * S, y: -place.y * S, climate: place.climate ?? climateOf.get(place.region) ?? null }));
    const byId = new Map(places.map(place => [place.id, place]));
    const routes = (Array.isArray(content.routes) ? content.routes : []).map((route, at) => ({ route, at, a: byId.get(route?.from), b: byId.get(route?.to), cls: classOf(content.routeKinds, route?.kind, ROUTE_CLASSES) }))
        .filter(item => item.a && item.b);
    return { content, regions, realms: list(content.realms), hue, places, byId, routes, layers, faint: all.filter(({ place }) => (place.layer ?? '') !== layer).map(({ place }) => ({ x: place.x * S, y: -place.y * S })) };
}

// The convex hull of points, each first padded into a ring of eight, so one or two places still make an area.
function hull(points, pad) {
    const ring = points.flatMap(p => Array.from({ length: 8 }, (_, n) => ({ x: p.x + pad * Math.cos(n * Math.PI / 4), y: p.y + pad * Math.sin(n * Math.PI / 4) })))
        .sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = pts => pts.reduce((out, p) => { while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); return out; }, []);
    const lower = half(ring), upper = half([...ring].reverse());
    const pts = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    return pts.length ? `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z` : '';
}

// The km a new route probably runs: the median km per map unit of the routes that give km, times this one's length.
function suggestKm(model, a, b) {
    const rates = model.routes.filter(({ route }) => finite(route.km) && route.km > 0).map(({ route, a: p, b: q }) => route.km / (Math.hypot(p.x - q.x, p.y - q.y) / S || 1)).sort((x, y) => x - y);
    if (!rates.length) return null;
    const rate = rates[Math.floor(rates.length / 2)];
    const units = Math.hypot(a.x - b.x, a.y - b.y) / S;
    return { rate: Math.round(rate), units: Math.round(units), km: Math.max(1, Math.round(rate * units / 10) * 10) };
}

function drawSvg(model, st, vb, u) {
    const tint = place => (st.colour === 'climates' ? CLIMATE_HUE[place.climate] ?? NO_CLIMATE : model.hue.get(place.region) ?? NO_CLIMATE);
    const areas = model.regions.map(region => {
        const pts = model.places.filter(place => place.region === region.id);
        if (!pts.length) return null;
        const colour = st.colour === 'climates' ? CLIMATE_HUE[region.climate] ?? NO_CLIMATE : model.hue.get(region.id);
        return svgEl('path', { class: ['area', st.colour === 'climates' && !region.climate ? 'unset' : null], d: hull(pts, 26), style: { fill: colour, stroke: colour }, dataset: { region: region.id } });
    });
    const realms = model.realms.map(realm => {
        const ids = new Set(Array.isArray(realm.regions) ? realm.regions : []);
        const pts = model.places.filter(place => ids.has(place.region));
        if (!pts.length) return null;
        const top = pts.reduce((a, b) => (b.y < a.y ? b : a));
        return svgEl('g', { class: 'realm', dataset: { realm: realm.id } }, svgEl('path', { d: hull(pts, 46) }),
            svgEl('text', { x: top.x, y: top.y - 56, 'text-anchor': 'middle', style: { 'font-size': `${11 * u}px` } }, `${String(realm.name ?? realm.id).toUpperCase()} · REALM`));
    });
    const sel = st.sel ?? {};
    const routes = model.routes.map(({ route, at, a, b, cls }) => svgEl('g', { class: ['rt', `c-${cls}`, sel.route === at ? 'sel' : null], dataset: { rt: String(at) } },
        svgEl('path', { class: 'hit', d: `M${a.x} ${a.y}L${b.x} ${b.y}`, style: { 'stroke-width': `${16 * u}px` } }),
        svgEl('path', { class: 'ln', d: `M${a.x} ${a.y}L${b.x} ${b.y}`, style: { 'stroke-width': `${(cls === 'relay-road' ? 4 : 3) * u}px` } })));
    const from = st.mode === 'route' ? st.from : null;
    const rubber = from && model.byId.get(from) && st.draft?.to && model.byId.get(st.draft.to)
        ? svgEl('path', { class: 'rubber', d: `M${model.byId.get(from).x} ${model.byId.get(from).y}L${model.byId.get(st.draft.to).x} ${model.byId.get(st.draft.to).y}`, style: { 'stroke-width': `${3 * u}px` } }) : null;
    // Zoomed far out (under 4 screen pixels a map unit), places are dots and only capitals keep a name.
    const dots = S / u < 4;
    const r = (dots ? 4 : 11) * u, fs = 12 * u;
    const named = place => !dots || classOf(model.content.placeKinds, place.kind, PLACE_CLASSES) === 'capital';
    const places = model.places.map(place => svgEl('g', { class: ['pl', sel.place === place.id || from === place.id || st.draft?.to === place.id ? 'sel' : null, place.hidden ? 'hid' : null],
        dataset: { pl: place.id, climate: st.colour === 'climates' ? place.climate : null }, role: 'button', tabindex: 0, 'aria-label': place.name },
    svgEl('circle', { class: 'hit', cx: place.x, cy: place.y, r: 22 * u }),
    svgEl('circle', { class: 'b', cx: place.x, cy: place.y, r, style: { stroke: tint(place), 'stroke-width': `${3 * u}px` } }),
    dots ? null : svgEl('svg', { class: 'g', x: place.x - r * 0.6, y: place.y - r * 0.6, width: r * 1.2, height: r * 1.2, viewBox: '0 0 24 24', fill: 'currentColor' }, ...(glyph(placeGlyph(place.kind))?.childNodes ?? [])),
    named(place) ? svgEl('text', { x: place.x + r + 5 * u, y: place.y + fs * 0.35, style: { 'font-size': `${fs}px`, 'stroke-width': `${3 * u}px` } }, place.name) : null));
    // A grid line every 10 map units, or every 100 when that is too dense to see.
    const step = S * (vb.w / (S * 10) > 40 ? 100 : 10), grid = [];
    for (let i = Math.floor(vb.x / step) * step; i <= vb.x + vb.w; i += step) grid.push(svgEl('path', { class: 'grid', d: `M${i} ${vb.y}V${vb.y + vb.h}` }));
    for (let i = Math.floor(vb.y / step) * step; i <= vb.y + vb.h; i += step) grid.push(svgEl('path', { class: 'grid', d: `M${vb.x} ${i}H${vb.x + vb.w}` }));
    return svgEl('svg', { class: 'mp st-mp', viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, preserveAspectRatio: 'xMidYMid meet', 'aria-label': 'Map' },
        svgEl('rect', { class: 'land', x: vb.x - vb.w, y: vb.y - vb.h, width: vb.w * 3, height: vb.h * 3 }), grid,
        model.faint.map(p => svgEl('circle', { class: 'faint', cx: p.x, cy: p.y, r: 3 * u })),
        areas, realms, routes, rubber, places);
}

function legend(model, st) {
    if (st.colour !== 'climates') {
        return h('div', { class: 'legend2 st-mleg' }, LEGEND.map(([cls, label]) => h('span', null, h('i', { class: `rk c-${cls}` }), label)),
            h('span', null, h('i', { class: 'rk realm' }), 'realm'), h('span', null, h('i', { class: 'rk hid' }), 'hidden until found'));
    }
    const counts = new Map();
    for (const region of model.regions) counts.set(region.climate ?? '', (counts.get(region.climate ?? '') ?? 0) + 1);
    return h('div', { class: 'legend2 st-mleg' }, h('b', 'Climate · regions'),
        CLIMATES.filter(name => counts.has(name)).map(name => h('span', null, h('i', { class: 'st-swatch', style: { background: CLIMATE_HUE[name] } }), `${name} ${counts.get(name)}`)),
        counts.has('') ? h('span', null, h('i', { class: 'st-swatch unset' }), `not set: reads as temperate ${counts.get('')}`) : null);
}

const panelRow = (title, sub, onClick, extra = null) => h('div', { class: 'srow st-mrow' },
    h('span', { class: 'lb' }, onClick ? h('button', { type: 'button', class: 'lnk st-mgo', onClick }, h('b', title)) : h('b', title), sub ? h('small', sub) : null), extra ? h('span', { class: 'ctl' }, extra) : null);

// A map-unit coordinate row with − and + steps (1, or 10 with Shift).
function stepRow(label, hint, value, onValue) {
    const box = h('input', { type: 'number', class: 'txt2', value: String(value ?? ''), 'aria-label': label });
    box.addEventListener('change', () => { const n = Number(box.value); if (box.value.trim() !== '' && Number.isFinite(n)) onValue(n); });
    const step = d => h('button', { type: 'button', class: 'btn2 st-step', 'aria-label': `${label} ${d > 0 ? 'up' : 'down'}`, onClick: e => onValue(Math.round(((value ?? 0) + d * (e?.shiftKey ? 10 : 1)) * 10) / 10) }, d > 0 ? '+' : '−');
    return h('div', { class: 'srow', dataset: { key: label.toLowerCase() } }, h('span', { class: 'lb' }, h('b', label), h('small', hint)), h('span', { class: 'ctl st-steps' }, step(-1), box, step(1)));
}

/** `ctx`: the page context (views/route.js). Returns the map page, or nothing for a pack with no placed places (the segment stays hidden). */
export function renderPage(ctx) {
    const doc = ctx.doc?.doc ?? ctx.doc;
    if (!doc || ctx.kind === 'game' || !list(doc.content?.places).some(place => finite(place.x) && finite(place.y))) return [];
    const editable = !ctx.legacy && typeof ctx.commit === 'function';
    const st = ctx.keep?.('map:view') ?? {};
    st.mode ??= 'select'; st.colour ??= 'regions'; st.layer ??= '';
    const focus = /^(places|routes)\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    if (focus && st.seen !== ctx.focus.rec) {
        st.seen = ctx.focus.rec;
        const raw = doc.content[focus[1]]?.[Number(focus[2])];
        if (focus[1] === 'places' && raw) { st.layer = raw.layer ?? ''; st.sel = { place: raw.id }; st.centre = raw.id; } else if (raw) st.sel = { route: Number(focus[2]) };
    }
    if (!editable) st.mode = 'select';
    const model = mapModel(doc, st.layer);
    const page = h('div', { class: 'st-map' });
    const box = h('div', { class: 'mapbox st-mapbox', dataset: { mode: st.mode } });
    const side = h('div', { class: 'sgrp st-mside', 'aria-live': 'polite' });
    const ratio = () => (box.clientWidth && box.clientHeight ? box.clientHeight / box.clientWidth : 0.7);
    const fitTo = places => { st.vb = fitBox(places.length ? places : model.places, 60, ratio()); };
    if (!st.vb) fitTo(model.places);
    const unit = () => st.vb.w / (box.clientWidth || 640);
    const commit = (patches, note = '') => {
        const result = ctx.commit(patches);
        st.note = result?.ok ? note : result?.refusal ?? 'The change was not made.';
        paint();
        return result;
    };
    const move = (place, x, y, note) => {
        if (x === place.raw.x && y === place.raw.y) return;
        commit([{ op: 'set', path: ['content', 'places', place.at, 'x'], value: x }, { op: 'set', path: ['content', 'places', place.at, 'y'], value: y }], note);
    };
    const select = sel => { st.sel = sel; st.confirm = false; st.note = ''; paint(); };
    // A new layer needs a new model: the page is drawn again in place.
    const again = () => { st.vb = null; if (page.parentNode) page.replaceWith(...renderPage(ctx)); };
    const centre = place => { const w = Math.min(st.vb.w, 600); st.vb = { x: place.x - w / 2, y: place.y - (w * ratio()) / 2, w, h: w * ratio() }; };

    // A tap on a place: Select picks it; Add a route takes it as the start, then as the end.
    function tapPlace(id) {
        if (st.mode !== 'route') return select({ place: id });
        if (!st.from || st.from === id) { st.from = id; st.draft = null; } else st.draft = { to: id, kind: Object.keys(model.content.routeKinds ?? {})[0] ?? 'road', km: null, name: '' };
        st.note = ''; paint();
    }

    function sidePanel() {
        const nodes = [];
        if (st.note) nodes.push(h('p', { class: 'st-mnote', role: 'status' }, st.note));
        const place = st.sel?.place ? model.byId.get(st.sel.place) : null;
        const route = Number.isInteger(st.sel?.route) ? model.routes.find(item => item.at === st.sel.route) : null;
        if (st.mode === 'route' && st.from && st.draft) return [...nodes, newRoute()];
        if (st.mode === 'route') return [...nodes, h('div', { class: 'gt' }, 'Add a route'), h('p', { class: 'fine' }, st.from ? `${model.byId.get(st.from)?.name ?? st.from}, then the place it goes to. Esc stops.` : 'Tap the place it starts at, then the place it goes to. Esc stops.')];
        if (place) return [...nodes, placePanel(place)];
        if (route) return [...nodes, routePanel(route)];
        const inView = model.places.filter(p => p.x >= st.vb.x && p.x <= st.vb.x + st.vb.w && p.y >= st.vb.y && p.y <= st.vb.y + st.vb.h);
        const shown = model.regions.map(region => ({ region, count: inView.filter(p => p.region === region.id).length })).filter(item => item.count && (st.colour !== 'climates' || !item.region.climate));
        nodes.push(h('div', { class: 'st-mhead' }, h('b', 'Nothing selected'), h('small', editable ? 'Tap a place to select it, then drag it to move it. Tap a route to select it.' : 'Tap a place or a route to see it.')),
            h('div', { class: 'gt' }, st.colour === 'climates' ? `Regions with no climate · ${shown.length}` : `Regions in view · ${shown.length}`),
            shown.map(({ region, count }) => panelRow(String(region.name ?? region.id), `${region.climate ?? (st.colour === 'climates' ? 'reads as temperate' : 'no climate')} · ${plural(count, 'place')}`,
                () => { fitTo(model.places.filter(p => p.region === region.id)); paint(); }, h('i', { class: 'st-swatch', style: { background: model.hue.get(region.id) } }))));
        return nodes;
    }

    function placePanel(place) {
        const raw = place.raw;
        const regionName = model.regions.find(region => region.id === place.region)?.name ?? place.region;
        const mine = model.routes.filter(({ route }) => route.from === place.id || route.to === place.id);
        return h('div', { class: 'st-mplace', dataset: { rec: `places.${place.at}` } },
            h('div', { class: 'st-mhead' }, h('b', place.name, place.hidden ? h('span', { class: 'tg2' }, 'hidden') : null), h('small', [place.kind, regionName, place.climate].filter(Boolean).join(' · '))),
            editable ? [stepRow('X', 'How far east, in map units', raw.x, x => move(place, x, raw.y)), stepRow('Y', 'How far north, in map units', raw.y, y => move(place, raw.x, y)),
                h('p', { class: 'fine' }, 'Drag it on the map, or use the arrow keys: 1 map unit, 10 with Shift.')] : h('p', { class: 'fine' }, `At ${raw.x}, ${raw.y}.`),
            h('div', { class: 'gt' }, `Routes from here · ${mine.length}`),
            mine.map(({ route, at, cls }) => panelRow(model.byId.get(route.from === place.id ? route.to : route.from)?.name ?? '?', [route.kind ?? cls, finite(route.km) ? `${route.km} km` : null].filter(Boolean).join(' · '),
                () => select({ route: at }), editable ? h('button', { type: 'button', class: 'btn2 dng st-rdel', 'aria-label': `Delete the route to ${route.from === place.id ? route.to : route.from}`, onClick: () => { select({ route: at }); st.confirm = true; paint(); } }, '×') : null)),
            editable ? h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-addfrom', onClick: () => { st.mode = 'route'; st.from = place.id; st.draft = null; st.sel = null; paint(); } }, '+ Add a route from here')) : null);
    }

    function routePanel({ route, at, a, b, cls }) {
        const users = usedBy(ctx.refs, 'route', routeKey(route)).filter(use => !String(use.path?.join?.('.') ?? '').startsWith(`content.routes.${at}`));
        const said = users.length ? `${plural(users.length, 'other record')} name${users.length === 1 ? 's' : ''} it.` : 'Nothing else names this route.';
        return h('div', { class: 'st-mroute', dataset: { rec: `routes.${at}` } },
            h('div', { class: 'st-mhead' }, h('b', `${a.name} → ${b.name}`), h('small', [route.kind ?? cls, finite(route.km) ? `${route.km} km` : null, route.name, said].filter(Boolean).join(' · '))),
            !editable ? null : st.confirm
                ? h('div', { class: 'cfm rec st-rconfirm', role: 'group' }, h('b', `Delete the route ${a.name} → ${b.name}?`), h('small', `${users.length ? said : 'No other record names it.'} Undo brings it back.`),
                    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-rdel-yes', onClick: () => { st.sel = null; st.confirm = false; commit([{ op: 'remove', path: ['content', 'routes', at] }], `Deleted the route ${a.name} → ${b.name}.`); } }, 'Delete'),
                        h('button', { type: 'button', class: 'btn2 st-rkeep', onClick: () => { st.confirm = false; paint(); } }, 'Keep it')))
                : h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 dng st-rdel', onClick: () => { st.confirm = true; paint(); } }, 'Delete')));
    }

    function newRoute() {
        const a = model.byId.get(st.from), b = model.byId.get(st.draft.to), d = st.draft;
        const kinds = Object.keys(model.content.routeKinds ?? {});
        const options = kinds.length ? kinds : ROUTE_CLASSES.filter(name => name !== 'none');
        const twin = model.routes.find(({ route }) => (route.from === a.id && route.to === b.id) || (route.from === b.id && route.to === a.id));
        const guess = suggestKm(model, a, b);
        const name = (d.name ?? '').trim();
        const problem = twin && !name ? `A route already joins these two places (${[twin.route.kind, finite(twin.route.km) ? `${twin.route.km} km` : null].filter(Boolean).join(', ')}). Give this one a name to add it as well.` : '';
        const kmBox = h('input', { type: 'number', class: 'txt2', value: d.km ?? guess?.km ?? '', 'aria-label': 'Km' });
        kmBox.addEventListener('change', () => { d.km = kmBox.value.trim() === '' ? null : Number(kmBox.value); });
        const nameBox = h('input', { class: 'txt2', value: d.name ?? '', placeholder: `${a.id}–${b.id}`, 'aria-label': 'Name' });
        nameBox.addEventListener('change', () => { d.name = nameBox.value; paint(); });
        const kind = h('select', { class: 'sel2', 'aria-label': 'Kind', onChange: e => { d.kind = e.target.value; } }, options.map(o => h('option', { value: o, selected: o === d.kind }, o)));
        const add = () => {
            const km = kmBox.value.trim() === '' ? null : Number(kmBox.value);
            if (problem) return;
            const record = { ...(name ? { name } : {}), from: a.id, to: b.id, kind: d.kind, ...(Number.isFinite(km) && km !== null ? { km } : {}) };
            const at = Array.isArray(model.content.routes) ? model.content.routes.length : 0;
            const patch = Array.isArray(model.content.routes) ? { op: 'insert', path: ['content', 'routes', at], value: record } : { op: 'set', path: ['content', 'routes'], value: [record] };
            st.mode = 'select'; st.from = null; st.draft = null; st.sel = { route: at };
            commit([patch], `Added the route ${a.name} → ${b.name}.`);
        };
        const field = (label, hint, control, extra = null) => h('div', { class: 'srow', dataset: { key: label.toLowerCase() } }, h('span', { class: 'lb' }, h('b', label), h('small', hint)), h('span', { class: 'ctl' }, control), extra);
        return h('div', { class: 'st-mnew' }, h('div', { class: 'gt' }, 'New route'),
            field('From', 'The place it starts at', h('b', a.name)),
            field('To', 'The place it ends at (it runs both ways)', h('b', b.name), problem ? h('small', { class: 'st-problem', role: 'alert' }, problem) : null),
            field('Kind', `Counts as: ${classOf(model.content.routeKinds, d.kind, ROUTE_CLASSES)}`, kind),
            field('Km', `How long it is. Without km (or hours) travel cannot time it.${guess ? ` Suggested: your routes run about ${guess.rate} km a map unit, and this one is ${guess.units} units` : ''}`, kmBox),
            field('Name', `Other records name it by this. Blank: "${a.id}–${b.id}". Needed when two routes join the same places`, nameBox),
            h('div', { class: 'addrow st-macts' }, h('button', { type: 'button', class: 'btn2 pri st-radd', disabled: Boolean(problem), onClick: add }, 'Add the route'),
                h('button', { type: 'button', class: 'btn2 st-rcancel', onClick: () => { st.from = null; st.draft = null; paint(); } }, 'Cancel')));
    }

    function paint() {
        if (st.centre && model.byId.has(st.centre)) centre(model.byId.get(st.centre));
        st.centre = null;
        st.vb.h = st.vb.w * ratio();
        box.dataset.mode = st.mode;
        box.replaceChildren(drawSvg(model, st, st.vb, unit()));
        side.replaceChildren(...sidePanel().flat().filter(Boolean));
        tools.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
        tools.querySelectorAll('[data-colour]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.colour === st.colour)));
        foot.replaceChildren(legend(model, st));
    }

    // Pointer: drag a place (Select) to move it; drag the ground to pan; a tap without movement picks a place or a route.
    let press = null;
    const toUnits = e => ({ dx: (e.clientX - press.cx) * unit(), dy: (e.clientY - press.cy) * unit() });
    box.addEventListener('pointerdown', e => {
        const pl = e.target.closest?.('[data-pl]'), rt = e.target.closest?.('[data-rt]');
        press = { cx: e.clientX, cy: e.clientY, pl: pl?.dataset.pl ?? null, rt: rt ? Number(rt.dataset.rt) : null, vb: { ...st.vb }, moved: false, node: pl };
        box.setPointerCapture?.(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
        if (!press) return;
        if (Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 3) press.moved = true;
        if (!press.moved) return;
        const { dx, dy } = toUnits(e);
        const place = press.pl && model.byId.get(press.pl);
        if (place && editable && st.mode === 'select') {
            press.to = { x: Math.round(place.raw.x + dx / S), y: Math.round(place.raw.y - dy / S) };
            press.node.setAttribute('transform', `translate(${(press.to.x - place.raw.x) * S} ${(place.raw.y - press.to.y) * S})`);
            press.node.classList.add('drag');
            tip.textContent = `x ${press.to.x} · y ${press.to.y}   was ${place.raw.x} · ${place.raw.y}`;
            tip.hidden = false;
        } else if (!press.pl) {
            st.vb = { ...press.vb, x: press.vb.x - dx, y: press.vb.y - dy };
            box.querySelector('svg')?.setAttribute('viewBox', `${st.vb.x} ${st.vb.y} ${st.vb.w} ${st.vb.h}`);
        }
    });
    const release = e => {
        const was = press;
        press = null;
        tip.hidden = true;
        if (!was) return;
        if (e?.type === 'pointercancel' || e?.key === 'Escape') { paint(); return; }
        const place = was.pl && model.byId.get(was.pl);
        if (was.moved && place && was.to) { st.sel = { place: place.id }; move(place, was.to.x, was.to.y, `Moved from ${place.raw.x}, ${place.raw.y}. One move is one Undo.`); paint(); return; }
        if (was.moved) { paint(); return; }
        if (was.pl) tapPlace(was.pl); else if (Number.isInteger(was.rt) && st.mode === 'select') select({ route: was.rt }); else if (st.sel) select(null);
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    box.addEventListener('keydown', e => {
        const id = e.target.closest?.('[data-pl]')?.dataset.pl;
        const place = id && model.byId.get(id);
        if (e.key === 'Escape') { if (press) return release(e); st.from = null; st.draft = null; st.mode = 'select'; return select(null); }
        if (!place) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); tapPlace(id); return; }
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
        if (!d || !editable) return;
        e.preventDefault?.();
        st.sel = { place: id };
        move(place, Math.round((place.raw.x + d[0]) * 10) / 10, Math.round((place.raw.y + d[1]) * 10) / 10, '');
    });
    const tip = h('div', { class: 'st-mtip', hidden: true, role: 'status' });

    // The tools: find, a region or realm to fit, zoom, fit; the mode, the colouring and the layer.
    const zoom = f => { const cx = st.vb.x + st.vb.w / 2, cy = st.vb.y + st.vb.h / 2, w = Math.min(4000, Math.max(80, st.vb.w * f)); st.vb = { x: cx - w / 2, y: cy - (w * ratio()) / 2, w, h: w * ratio() }; paint(); };
    const find = h('input', { class: 'psrch', placeholder: 'Find a place', 'aria-label': 'Find a place', value: st.find ?? '' });
    find.addEventListener('change', () => {
        st.find = find.value;
        const needle = find.value.trim().toLowerCase();
        const hit = needle && list(doc.content.places).findIndex(p => `${p.name ?? ''} ${p.id ?? ''}`.toLowerCase().includes(needle));
        if (!needle || hit < 0) return;
        const raw = doc.content.places[hit];
        if ((raw.layer ?? '') !== st.layer) { st.layer = raw.layer ?? ''; st.sel = { place: raw.id }; st.centre = raw.id; again(); return; }
        st.sel = { place: raw.id }; centre(model.byId.get(raw.id)); paint();
    });
    const areaPick = h('select', { 'aria-label': 'Show a realm or region', onChange: e => { const [kind, id] = e.target.value.split(':'); const ids = kind === 'realm' ? new Set(model.realms.find(r => r.id === id)?.regions ?? []) : new Set([id]);
        fitTo(e.target.value ? model.places.filter(p => ids.has(p.region)) : model.places); paint(); } },
    h('option', { value: '' }, 'Everything'), model.realms.map(realm => h('option', { value: `realm:${realm.id}` }, String(realm.name ?? realm.id))), model.regions.map(region => h('option', { value: `region:${region.id}` }, String(region.name ?? region.id))));
    const icon = (name, label, onClick) => h('button', { type: 'button', class: 'ibtn btn2', 'aria-label': label, title: label, onClick }, glyph(name) ?? label);
    const seg = (key, items) => h('div', { class: 'sseg2 st-seg', role: 'group' }, items.map(([value, label]) => h('button', { type: 'button', dataset: { [key]: value }, 'aria-pressed': 'false',
        onClick: () => { st[key] = value; if (key === 'mode') { st.from = null; st.draft = null; st.sel = null; } paint(); } }, label)));
    const layers = [...model.layers.keys()];
    const layerPick = h('select', { 'aria-label': 'Map layer', onChange: e => { st.layer = e.target.value; st.sel = null; st.from = null; st.draft = null; again(); } },
        layers.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).map(name => h('option', { value: name, selected: name === st.layer }, `${name || 'Main map'} · ${model.layers.get(name)}`)));
    const tools = h('div', { class: 'st-mtools' },
        h('div', { class: 'mtools' }, find, areaPick, icon('plus', 'Zoom in', () => zoom(0.75)), icon('minus', 'Zoom out', () => zoom(1.33)), icon('fit', 'Fit all places', () => { fitTo(model.places); paint(); })),
        h('div', { class: 'st-mrow2' }, editable ? seg('mode', [['select', 'Select'], ['route', 'Add a route']]) : null, seg('colour', [['regions', 'Regions'], ['climates', 'Climates']]), layerPick));
    const foot = h('div', { class: 'st-mfoot' });
    if (typeof globalThis.ResizeObserver === 'function') {
        let sized = Boolean(st.sized);
        new globalThis.ResizeObserver(() => { if (!box.clientWidth) return; if (!sized) { sized = st.sized = true; if (!st.centre) fitTo(model.places); } paint(); }).observe(box);
    }
    paint();
    page.append(...[
        editable ? null : h('div', { class: 'sgrp st-mro' }, h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', 'Read-only: an old-format pack'), h('small', 'Places can’t be moved and routes can’t be added here.')))),
        h('section', { class: 'sgrp st-mcard' }, tools, h('div', { class: 'st-mwrap' }, h('div', { class: 'st-mstage' }, box, tip), side), foot)].filter(Boolean));
    return [page];
}
