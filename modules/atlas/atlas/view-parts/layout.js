// Clips route segments to the stage, eases view transitions, and places unlocated places.

import { boundsOf } from './geometry.js';

/**
 * The part of segment a→b inside `rect` `{ x, y, w, h }` (Liang–Barsky), or null when none is.
 * Routes are drawn in stage pixels and cut to the stage: a line thousands of times longer than
 * the screen (a village street at a country's zoom) is never handed to the browser whole.
 */
export function clipSegment(a, b, rect) {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    const edges = [[-dx, a.x - rect.x], [dx, rect.x + rect.w - a.x], [-dy, a.y - rect.y], [dy, rect.y + rect.h - a.y]];
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) return null;
            continue;
        }
        const t = q / p;
        if (p < 0) {
            if (t > t1) return null;
            if (t > t0) t0 = t;
        } else {
            if (t < t0) return null;
            if (t < t1) t1 = t;
        }
    }
    return { a: { x: a.x + dx * t0, y: a.y + dy * t0 }, b: { x: a.x + dx * t1, y: a.y + dy * t1 } };
}

/** A step between two views for an eased move: `t` in 0..1 (zoom eases in log space). */
export function between(a, b, t) {
    const ease = 1 - (1 - t) ** 3;
    const k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * ease);
    return { cx: a.cx + (b.cx - a.cx) * ease, cy: a.cy + (b.cy - a.cy) * ease, k };
}

/**
 * Map-space points for places without coordinates, deterministically: beside a placed place a
 * route joins them to (one step round a circle per newcomer), else in a row under the rest.
 * `places`: `[{ id, point|null }]`; `links`: `[[idA, idB]]`. Returns `Map(id → point)` for all.
 */
export function placeUnplaced(places, links) {
    const at = new Map(places.filter(place => place.point).map(place => [place.id, place.point]));
    const box = boundsOf([...at.values()]);
    const step = Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.06 || 1;
    const around = new Map();
    for (let pass = 0; pass < 3; pass += 1) {
        for (const place of places) {
            if (at.has(place.id)) continue;
            const link = links.find(([a, b]) => (a === place.id && at.has(b)) || (b === place.id && at.has(a)));
            if (!link) continue;
            const anchor = link[0] === place.id ? link[1] : link[0];
            const turn = around.get(anchor) ?? 0;
            around.set(anchor, turn + 1);
            const angle = turn * 2.399963;            // the golden angle: newcomers never stack
            const base = at.get(anchor);
            at.set(place.id, { x: base.x + Math.cos(angle) * step * (1 + turn * 0.25), y: base.y + Math.sin(angle) * step * (1 + turn * 0.25) });
        }
    }
    let row = 0;
    for (const place of places) {
        if (at.has(place.id)) continue;
        at.set(place.id, { x: box.minX + row * step * 2, y: box.maxY + step * 2 });
        row += 1;
    }
    return at;
}
