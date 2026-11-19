// Folds a town's sub-places (its wards, the dungeon under it) into one map marker, fans them out round the town at a close zoom, and pans the map so a place stays clear of the sheet.
import { zoomLimits } from './map-view.js';

const HUB_KINDS = [/capital/i, /city/i, /town|port|harbou?r|village|hamlet|market/i, /fort|outpost|camp|keep|hold|tower|watch|depot/i];
const RING_GAP_PX = 50;   // px between neighbouring fanned dots, room for two 24 px tap circles
const RING_MIN_PX = 56;   // px from the town to its fanned sub-places at the least
const SHEET_GAP_PX = 28;  // px kept between a place and the sheet's edge
const key = text => String(text ?? '').trim().toLowerCase();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hubRank = p => {
  const i = HUB_KINDS.findIndex(re => re.test(p.kind ?? ''));
  return i < 0 ? HUB_KINDS.length : i;
};
const ringPx = n => Math.max(RING_MIN_PX, (n * RING_GAP_PX) / (2 * Math.PI));
const cache = new WeakMap();

/** A sub-place's name under its town: "Auvoth / Sealcrown" under Auvoth is "Sealcrown"; other names stay whole. */
export function subName(place, hub) {
  const head = `${hub?.name ?? ''} / `;
  return hub && key(place.name).startsWith(key(head)) ? place.name.slice(head.length) : place.name;
}

/**
 * Which places fold into a town: a "Town / Ward" name under that town (when it lies within a tenth of the closest zoom's width),
 * and any place nearly on top of a place of the same or a higher kind (within a sixtieth of that width), cities first.
 * Returns { parent: Map sub id → town id, subs: Map town id → its sub-places in list order }; the same list gives the same answer.
 */
export function groupPlaces(places = []) {
  if (cache.has(places)) return cache.get(places);
  const min = zoomLimits(places).min;
  const byName = new Map(places.map(p => [key(p.name), p]));
  const parent = new Map();
  for (const p of places) {
    const cut = p.name.indexOf(' / ');
    const top = cut > 0 ? byName.get(key(p.name.slice(0, cut))) : null;
    if (top && top !== p && !top.name.includes(' / ') && dist(p, top) <= min / 10) parent.set(p.id, top.id);
  }
  const order = places.map((p, i) => ({ p, i })).sort((a, b) => hubRank(a.p) - hubRank(b.p) || a.i - b.i).map(o => o.p);
  for (const hub of order) {
    if (parent.has(hub.id)) continue;
    for (const q of places) {
      if (q === hub || parent.has(q.id) || dist(q, hub) > min / 60) continue;
      for (const [s, h] of parent) if (h === q.id) parent.set(s, hub.id);
      parent.set(q.id, hub.id);
    }
  }
  const subs = new Map();
  for (const p of places) {
    const h = parent.get(p.id);
    if (h) subs.set(h, [...(subs.get(h) ?? []), p]);
  }
  const out = { parent, subs };
  cache.set(places, out);
  return out;
}

// A town's sub-places fan out once its ring clears every other place, at once at the closest zoom, never when zoomed far out.
function fansOut(hub, subs, places, parent, vb, scale, minW) {
  if (vb.w > minW * 4) return false;
  if (vb.w <= minW * 1.05) return true;
  const room = (2 * ringPx(subs.length) + 30) / scale;
  return places.every(q => q === hub || parent.get(q.id) === hub.id || dist(q, hub) >= room);
}

/**
 * The places to draw at this view (scale px per map unit; minW the closest zoom's width). A folded town is one marker named
 * "Auvoth · 4" that is here, visited, when any of its sub-places is, with `has` = their ids; a fanned town keeps its own name and its
 * sub-places sit on a ring round it under their short names. Returns { shown, pos: Map id → drawn place (a folded sub-place → its town),
 * alias: Map folded sub id → town id, fans: [{ hub, subs }] }.
 */
export function layoutGroups(places, groups, vb, scale, minW) {
  const shown = [];
  const pos = new Map();
  const alias = new Map();
  const fans = [];
  for (const p of places) {
    if (groups.parent.has(p.id)) continue;
    const subs = groups.subs.get(p.id);
    if (!subs) {
      shown.push(p);
      pos.set(p.id, p);
    } else if (fansOut(p, subs, places, groups.parent, vb, scale, minW)) {
      const R = ringPx(subs.length) / scale;
      const ring = subs.map((s, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / subs.length;
        return { ...s, x: p.x + R * Math.cos(a), y: p.y + R * Math.sin(a), name: subName(s, p) };
      });
      shown.push(p, ...ring);
      pos.set(p.id, p);
      for (const s of ring) pos.set(s.id, s);
      fans.push({ hub: p, subs: ring });
    } else {
      const folded = { ...p, name: `${p.name} · ${subs.length}`, here: p.here || subs.some(s => s.here), visited: p.visited || subs.some(s => s.visited), has: subs.map(s => s.id) };
      shown.push(folded);
      for (const id of [p.id, ...folded.has]) pos.set(id, folded);
      for (const s of subs) alias.set(s.id, p.id);
    }
  }
  return { shown, pos, alias, fans };
}

/**
 * The view box that keeps point `pt` clear of a sheet over the map, or null when it is clear already or there is no room above the
 * sheet. cover = the sheet's px box measured from the map's top-left { top, bottom, left, right }; H = the map's px height.
 */
export function panAbove(vb, pt, scale, cover, H) {
  const sx = (pt.x - vb.x) * scale;
  const sy = (pt.y - vb.y) * scale;
  const g = SHEET_GAP_PX;
  const hidden = sy < g || sy > H - g || (sx > cover.left - g && sx < cover.right + g && sy > cover.top - g && sy < cover.bottom + g);
  const free = Math.min(cover.top, H);
  if (!hidden || free < 3 * g) return null;
  return { ...vb, y: vb.y + (sy - free / 2) / scale };
}
