// Works out each map label's box and moves a label up or down only when it would sit on another one.

const isBig = p => Boolean(p.here) || /city|market/i.test(p.kind);

/** Returns the sizes and side of one place's label: radius r, font size fs, flip (drawn left of the dot). */
export function labelGeom(p, u, vb) {
  const big = isBig(p);
  const r = Math.max(big ? 17 : 13, 15 * u);
  const fs = 13 * u * (big ? 1.1 : 1);
  const flip = p.x + r + 6 + p.name.length * fs * 0.6 > vb.x + vb.w;
  return { r, fs, flip };
}

function box(p, u, vb) {
  const { r, fs, flip } = labelGeom(p, u, vb);
  const w = p.name.length * fs * 0.6;
  const x = flip ? p.x - r - 6 - w : p.x + r + 6;
  return { x, y: p.y - fs * 0.65, w, h: fs * 1.3, step: fs * 1.3 };
}

const hits = (a, b, dy) => a.x < b.x + b.w && b.x < a.x + a.w && a.y + dy < b.y + b.h && b.y < a.y + dy + a.h;

/** Returns a Map of place id → vertical shift for labels that overlap an earlier one; labels that overlap nothing are not in it. */
export function nudgeLabels(places, u, vb) {
  const boxes = places.map(p => ({ id: p.id, ...box(p, u, vb) }));
  const placed = [];
  const shifts = new Map();
  for (const b of boxes) {
    let dy = 0;
    if (placed.some(o => hits(b, o, 0))) {
      dy = null;
      for (let k = 1; k <= 4 && dy === null; k += 1) {
        for (const sign of [-1, 1]) {
          const cand = sign * k * b.step;
          if (!placed.some(o => hits(b, o, cand))) { dy = cand; break; }
        }
      }
      if (dy === null) dy = 0;
      else shifts.set(b.id, dy);
    }
    placed.push({ ...b, y: b.y + dy });
  }
  return shifts;
}
