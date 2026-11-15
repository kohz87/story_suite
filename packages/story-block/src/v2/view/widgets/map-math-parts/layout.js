// Deterministic auto-layout for map nodes that have no coordinates.

import { round } from './shared-round.js';

const hasXY = node => Number.isFinite(node.x) && Number.isFinite(node.y);

/**
 * Positions for every node: nodes with x/y keep them; the others are placed deterministically. Without
 * edges to them they go on a grid (in the order given) beside the placed nodes; with edges, a fixed
 * number of force-directed steps (repulsion between all nodes, springs along edges, placed nodes pinned)
 * starts from that grid. No randomness: the same nodes and edges always give the same map.
 * Returns `{ [id]: { x, y } }`.
 */
export function autoLayout(nodes, edges = [], { spacing = 100, iterations = 150 } = {}) {
    const out = {};
    const fixed = nodes.filter(hasXY);
    const free = nodes.filter(node => !hasXY(node));
    for (const node of fixed) out[node.id] = { x: node.x, y: node.y };
    if (!free.length) return out;

    // Grid start: to the right of the placed nodes (or at the origin when none is placed).
    const cols = Math.ceil(Math.sqrt(free.length));
    let originX = 0, originY = 0;
    if (fixed.length) {
        originX = Math.max(...fixed.map(node => node.x)) + spacing;
        originY = Math.min(...fixed.map(node => node.y));
    }
    const pos = new Map();
    free.forEach((node, index) => {
        pos.set(node.id, { x: originX + (index % cols) * spacing, y: originY + Math.floor(index / cols) * spacing });
    });
    for (const node of fixed) pos.set(node.id, { x: node.x, y: node.y });

    const freeIds = new Set(free.map(node => node.id));
    const links = edges.filter(edge => pos.has(edge.from) && pos.has(edge.to) && edge.from !== edge.to);
    const moving = links.some(edge => freeIds.has(edge.from) || freeIds.has(edge.to));
    if (moving && pos.size <= 400) {
        const ids = [...pos.keys()];
        const k = spacing;
        for (let step = 0; step < iterations; step++) {
            const temperature = spacing * 0.5 * (1 - step / iterations);
            const force = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const a = pos.get(ids[i]), b = pos.get(ids[j]);
                    let dx = a.x - b.x, dy = a.y - b.y;
                    // Two nodes on the same spot: separate them along a fixed direction by index.
                    if (dx === 0 && dy === 0) { dx = (j - i) * 0.01; dy = (i + 1) * 0.01; }
                    const d2 = dx * dx + dy * dy;
                    const d = Math.sqrt(d2);
                    const push = (k * k) / d;
                    const fa = force.get(ids[i]), fb = force.get(ids[j]);
                    fa.x += (dx / d) * push; fa.y += (dy / d) * push;
                    fb.x -= (dx / d) * push; fb.y -= (dy / d) * push;
                }
            }
            for (const edge of links) {
                const a = pos.get(edge.from), b = pos.get(edge.to);
                const dx = a.x - b.x, dy = a.y - b.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const pull = (d * d) / k;
                const fa = force.get(edge.from), fb = force.get(edge.to);
                fa.x -= (dx / d) * pull; fa.y -= (dy / d) * pull;
                fb.x += (dx / d) * pull; fb.y += (dy / d) * pull;
            }
            for (const id of freeIds) {
                const f = force.get(id);
                const length = Math.sqrt(f.x * f.x + f.y * f.y);
                if (!length) continue;
                const move = Math.min(length, temperature);
                const p = pos.get(id);
                p.x += (f.x / length) * move;
                p.y += (f.y / length) * move;
            }
        }
    }
    for (const node of free) {
        const p = pos.get(node.id);
        out[node.id] = { x: round(p.x), y: round(p.y) };
    }
    return out;
}
