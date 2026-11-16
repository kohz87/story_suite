// Converts between map space and stage pixels and clamps views within bounds.

import { MAX_ZOOM_SPAN, NEAR_PX, ZOOM_IN, ZOOM_OUT } from './constants-zoom.js';
import { clamp } from './shared-math.js';

/**
 * The zoom range for a layer `{ min, max }` in pixels per unit: from 2× further out than "fit" to
 * 8× closer, or closer still when places sit so tight that the two nearest need it to stand
 * NEAR_PX apart (a village's streets inside a whole country), never beyond MAX_ZOOM_SPAN × "fit".
 */
export function zoomLimits(fitK, gap = null) {
    const near = gap ? NEAR_PX / gap : 0;
    return { min: fitK * ZOOM_OUT, max: Math.min(fitK * MAX_ZOOM_SPAN, Math.max(fitK * ZOOM_IN, near)) };
}

/** The view with its zoom inside `limits` and its centre inside `box` (the view never leaves the world). */
export function clampView(view, box, limits) {
    return {
        cx: clamp(view.cx, box.minX, box.maxX),
        cy: clamp(view.cy, box.minY, box.maxY),
        k: limits ? clamp(view.k, limits.min, limits.max) : view.k,
    };
}

/** Map space → stage pixels. */
export const toScreen = (view, width, height, point) => ({ x: (point.x - view.cx) * view.k + width / 2, y: (point.y - view.cy) * view.k + height / 2 });

/** Stage pixels → map space. */
export const toMap = (view, width, height, sx, sy) => ({ x: view.cx + (sx - width / 2) / view.k, y: view.cy + (sy - height / 2) / view.k });
