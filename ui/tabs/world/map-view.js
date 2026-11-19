// Works out the map's view boxes: a fit with padding, a fit that leaves far-off outliers out, the opening view on where you are, and the zoom limits.

const PAD_PX = 44;   // px kept round the places a fit shows, room for a dot and the start of its label

/** Returns the view box that fits the points with padding (map units) at the given height/width ratio. */
export function fitBox(points, pad = 90, ratio = 0.7) {
  if (!points.length) return { x: 0, y: 0, w: 1000, h: 700 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) / ratio);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * ratio) / 2, w, h: w * ratio };
}

// One axis's kept span: from the middle 80 % outward, values stop at the first gap wider than a third of that middle span.
// At most a tenth of the values are left out on a side; a spread that is simply wide keeps everything.
function keptSpan(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const lo = Math.floor(n * 0.1);
  const hi = Math.ceil(n * 0.9) - 1;
  const gap = Math.max(s[hi] - s[lo], 1e-6) / 3;
  let top = n - 1;
  for (let i = hi; i < n - 1; i += 1) if (s[i + 1] - s[i] > gap) { top = i; break; }
  let bot = 0;
  for (let i = lo; i > 0; i -= 1) if (s[i] - s[i - 1] > gap) { bot = i; break; }
  return [s[bot > lo ? 0 : bot], s[n - 1 - top > lo ? n - 1 : top]];
}

// Splits points into the core and the far-off few (fewer than 8 points are all core).
function coreSplit(points) {
  if (points.length < 8) return { core: [...points], far: [] };
  const [x0, x1] = keptSpan(points.map(p => p.x));
  const [y0, y1] = keptSpan(points.map(p => p.y));
  const core = [];
  const far = [];
  for (const p of points) (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 ? core : far).push(p);
  return { core, far };
}

/** Zoom limits (view widths in map units) for these places: close enough to part near neighbours, far enough to see them all. */
export function zoomLimits(places) {
  const span = pts => (pts.length ? Math.max(Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y))) : 0);
  const core = span(coreSplit(places).core);
  return { min: Math.min(150, Math.max(20, core / 10)), max: Math.max(1600, 2 * span(places)) };
}

/**
 * Fits the points on a map `px` wide (0: not measured) with PAD_PX round them; far-off outliers are left out of the box and
 * returned as `far` (all = true fits every point). Returns { box, far }.
 */
export function fitView(points, { ratio = 0.7, px = 0, min = 150, all = false } = {}) {
  const { core, far } = all ? { core: points, far: [] } : coreSplit(points);
  const bare = fitBox(core, 0, ratio);
  if (!core.length) return { box: bare, far };
  const pad = px > 4 * PAD_PX ? (bare.w * PAD_PX) / (px - 2 * PAD_PX) : 90;
  const box = fitBox(core, pad, ratio);
  if (box.w >= min) return { box, far };
  return { box: { x: box.x + box.w / 2 - min / 2, y: box.y + box.h / 2 - (min * ratio) / 2, w: min, h: min * ratio }, far };
}

/**
 * The opening view: centred on `at` (default where you are) wide enough to show its dozen nearest places (never wider than a fit
 * of them all), and the trip if that stays under half the places' width; with no such place, the trip, else the places. opts = { ratio, px, limits, tripIds }.
 */
export function openBox(places, { ratio = 0.7, px = 0, limits = zoomLimits(places), tripIds = [], at = null } = {}) {
  const here = at ?? places.find(p => p.here);
  const trip = tripIds.map(id => places.find(p => p.id === id)).filter(Boolean);
  if (!here) return fitView(trip.length > 1 ? trip : places, { ratio, px, min: limits.min, all: trip.length > 1 }).box;
  const dists = places.filter(p => p !== here).map(p => Math.hypot(p.x - here.x, p.y - here.y)).sort((a, b) => a - b);
  const near = dists.length ? dists[Math.min(11, dists.length - 1)] : 0;
  const whole = fitView(places, { ratio, px }).box.w;
  let w = Math.min((2.4 * near) / ratio, whole);
  if (!at && trip.length) {
    const reach = 2.3 * Math.max(...trip.map(p => Math.max(Math.abs(p.x - here.x), Math.abs(p.y - here.y) / ratio)));
    w = Math.max(w, Math.min(reach, whole / 2));
  }
  w = Math.min(Math.max(w, limits.min), limits.max);
  return { x: here.x - w / 2, y: here.y - (w * ratio) / 2, w, h: w * ratio };
}
