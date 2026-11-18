// Radar geometry: the point of a ratio on an axis and the SVG points string of a series.

import { clamp, fmt } from '../dom.js';
import { RADIUS } from './shared-geometry.js';

/** The point for a ratio on axis `index` of `count`, starting at the top and going clockwise. */
export function radarPoint(index, count, ratio, radius = RADIUS) {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const r = clamp(ratio, 0, 1) * radius;
    return { x: Math.round(Math.cos(angle) * r * 100) / 100, y: Math.round(Math.sin(angle) * r * 100) / 100 };
}

/** The SVG `points` string of a series (ratios by axis). */
export function radarPoints(ratios) {
    return ratios.map((ratio, index) => {
        const point = radarPoint(index, ratios.length, ratio);
        return `${fmt(point.x)},${fmt(point.y)}`;
    }).join(' ');
}
