// Computes map-space points, bounding boxes, fit views, and point spacing.

import { FIT_PAD, LONE_SPAN } from './constants-view.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);

/** A place's map-space point, or null without coordinates. `orient`: `{ north: 'up'|'down', east: 'right'|'left' }`. */
export function mapPoint(place, orient = {}) {
    if (!finite(place?.x) || !finite(place?.y)) return null;
    return { x: orient.east === 'left' ? -place.x : place.x, y: orient.north === 'down' ? place.y : -place.y };
}

/** The box around map-space points `{ minX, minY, maxX, maxY }` (a lone point or none gets LONE_SPAN around it). */
export function boundsOf(points) {
    const list = points.filter(Boolean);
    if (!list.length) return { minX: -LONE_SPAN / 2, minY: -LONE_SPAN / 2, maxX: LONE_SPAN / 2, maxY: LONE_SPAN / 2 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { x, y } of list) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX - minX === 0 && maxY - minY === 0) {
        minX -= LONE_SPAN / 2; maxX += LONE_SPAN / 2;
        minY -= LONE_SPAN / 2; maxY += LONE_SPAN / 2;
    }
    return { minX, minY, maxX, maxY };
}

/** The view that shows the whole box on a `width` × `height` stage, centred, with FIT_PAD free around it. */
export function fitView(box, width, height) {
    const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    const pad = span * FIT_PAD;
    const w = box.maxX - box.minX + 2 * pad || 1;
    const h = box.maxY - box.minY + 2 * pad || 1;
    return { cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, k: Math.min(width / w, height / h) };
}

/** The shortest distance between two different map-space points (null with fewer than two). */
export function nearestGap(points) {
    const list = points.filter(Boolean);
    let best = Infinity;
    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
            if (d > 0 && d < best) best = d;
        }
    }
    return Number.isFinite(best) ? best : null;
}
