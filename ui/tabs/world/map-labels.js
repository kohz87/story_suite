// Decides which map labels show at the current view: place labels by priority, then the faint region names, none overlapping and none cut at the edges.

const isBig = p => Boolean(p.here) || /capital|city|market/i.test(p.kind ?? '');
const TOWN = /town|port|harbou?r|village|hamlet/i;
const CHAR = 0.62;   // an average bold glyph is about 0.6 em wide; a little more so two labels never touch
const EDGE = 3;      // px kept clear at the map's edges
const REGION_PX = 15;

/** Returns the sizes of one place's dot and label in map units at u map units per px: radius r, font size fs. */
export function labelGeom(p, u) {
  return { r: (isBig(p) ? 16 : 15) * u, fs: 13 * u * (isBig(p) ? 1.1 : 1) };
}

/**
 * The order labels are placed in (lower first): 0 where you are; 1 the trip's places and the selected or found place;
 * 2 cities and capitals; 3 towns, ports and villages; 4 the rest. Visited places, then the chosen region's, go first within a tier.
 */
export function labelRank(p, pick = {}) {
  if (p.here) return 0;
  const tier = pick.keep?.has(p.id) ? 1 : isBig(p) ? 2 : TOWN.test(p.kind ?? '') ? 3 : 4;
  return tier * 4 + (p.visited ? 0 : 2) + (pick.region && p.region === pick.region ? 0 : 1);
}

const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b, W, H) => b.x >= EDGE && b.y >= EDGE && b.x + b.w <= W - EDGE && b.y + b.h <= H - EDGE;

// The px boxes a label may take beside its dot: right, then left; each moved up or down just enough to stay inside the map,
// and for a must-show label also one or two lines above or below.
function spots(sx, sy, rpx, fpx, name, must, H) {
  const w = String(name ?? '').length * fpx * CHAR + 2;
  const h = fpx * 1.3;
  const y0 = Math.min(Math.max(sy - h / 2, EDGE), H - EDGE - h);
  const shifts = must ? [0, -h, h, -2 * h, 2 * h] : [0];
  const out = [];
  for (const dy of shifts) {
    out.push({ side: 'r', x: sx + rpx + 6, y: y0 + dy, w, h, dy: y0 + dy - (sy - h / 2) });
    out.push({ side: 'l', x: sx - rpx - 6 - w, y: y0 + dy, w, h, dy: y0 + dy - (sy - h / 2) });
  }
  return out;
}

/**
 * Plans the place labels for view box vb (map units) drawn at `scale` px per unit on a W×H px map. pick = { keep: Set of ids
 * that must show (trip, selected), region, avoid: px boxes kept clear }. A label covers no other label, no dot and nothing in
 * `avoid`. Returns { labels: Map id → { side 'r'|'l', dy (px) }, boxes: the shown px boxes, dots }; a place not in `labels` keeps its
 * dot and shows its name on hover, focus or when selected. Where you are always shows. `dots`: the dots' px boxes.
 */
export function planLabels(places, vb, scale, pick = {}) {
  const W = vb.w * scale;
  const H = vb.h * scale;
  const u = 1 / scale;
  const order = places.map((p, i) => ({ p, i, rank: labelRank(p, pick) }))
    .filter(({ p }) => {
      const sx = (p.x - vb.x) * scale;
      const sy = (p.y - vb.y) * scale;
      return sx >= 0 && sx <= W && sy >= 0 && sy <= H;
    })
    .sort((a, b) => a.rank - b.rank || a.i - b.i);
  const dots = order.map(({ p }) => {
    const rpx = labelGeom(p, u).r * scale * 0.8;
    return { x: (p.x - vb.x) * scale - rpx, y: (p.y - vb.y) * scale - rpx, w: 2 * rpx, h: 2 * rpx };
  });
  const labels = new Map();
  const boxes = [];
  const clear = [...(pick.avoid ?? []), ...dots];
  for (const { p, rank } of order) {
    const { r, fs } = labelGeom(p, u);
    const must = rank < 8;
    const tries = spots((p.x - vb.x) * scale, (p.y - vb.y) * scale, r * scale, fs * scale, p.name, must, H);
    let spot = tries.find(b => inside(b, W, H) && !boxes.some(o => hits(b, o)) && !clear.some(o => hits(b, o)));
    if (!spot && p.here) spot = tries.find(b => inside(b, W, H) && !boxes.some(o => hits(b, o)));
    if (!spot && p.here) spot = tries.find(b => inside(b, W, H)) ?? tries[0];
    if (!spot) continue;
    boxes.push(spot);
    labels.set(p.id, { side: spot.side, dy: spot.dy });
  }
  return { labels, boxes, dots };
}

/**
 * The region names to draw at this view: one per region at its places' middle (or the map's own labels), kept only where it fits
 * whole, touches nothing in `taken` (the shown labels) and lies over at most a few of the `dots` (faint, behind them).
 */
export function planRegions(places, terrainLabels, vb, scale, taken = [], dots = []) {
  const cands = Array.isArray(terrainLabels) && terrainLabels.length
    ? terrainLabels.map(l => ({ text: l.text, x: l.x, y: l.y, italic: Boolean(l.italic), size: 0 }))
    : regionCentres(places);
  const W = vb.w * scale;
  const H = vb.h * scale;
  const boxes = [...taken];
  const shown = [];
  for (const c of cands.sort((a, b) => b.size - a.size)) {
    const w = c.text.length * REGION_PX * (c.italic ? 0.75 : 0.95);
    const box = { x: (c.x - vb.x) * scale - w / 2, y: (c.y - vb.y) * scale - REGION_PX * 0.8, w, h: REGION_PX * 1.1 };
    if (!inside(box, W, H) || boxes.some(o => hits(box, o)) || dots.filter(o => hits(box, o)).length > 3) continue;
    boxes.push(box);
    shown.push({ ...c, fs: REGION_PX / scale });
  }
  return shown;
}

const median = list => {
  const s = [...list].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

function regionCentres(places) {
  const groups = new Map();
  for (const p of places) {
    if (!p.region) continue;
    if (!groups.has(p.region)) groups.set(p.region, []);
    groups.get(p.region).push(p);
  }
  return [...groups].map(([name, list]) => ({ text: name.toUpperCase(), x: median(list.map(p => p.x)), y: median(list.map(p => p.y)), italic: false, size: list.length }));
}
