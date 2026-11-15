// Zooming about a point, panning, centring and keeping the view inside the world.

import { ZOOM_IN_LIMIT, ZOOM_OUT_LIMIT } from './limits.js';
import { fitView } from './bounds.js';

/**
 * Zooms by `factor` (> 1 closer) keeping the world point (fx, fy) where it is on screen, clamped to the
 * zoom limits relative to the fitted view.
 */
export function zoomAt(view, factor, fx, fy, world) {
    const fit = fitView(world, view.w / view.h);
    const w = Math.min(fit.w / ZOOM_OUT_LIMIT, Math.max(fit.w / ZOOM_IN_LIMIT, view.w / factor));
    const scale = w / view.w;
    const h = view.h * scale;
    return clampView({ x: fx - (fx - view.x) * scale, y: fy - (fy - view.y) * scale, w, h }, world);
}

/** Moves the view by (dx, dy) world units, keeping its centre inside the world. */
export function panBy(view, dx, dy, world) {
    return clampView({ ...view, x: view.x + dx, y: view.y + dy }, world);
}

/** Keeps the view's centre inside the world rectangle. */
export function clampView(view, world) {
    const cx = Math.min(world.x + world.w, Math.max(world.x, view.x + view.w / 2));
    const cy = Math.min(world.y + world.h, Math.max(world.y, view.y + view.h / 2));
    return { x: cx - view.w / 2, y: cy - view.h / 2, w: view.w, h: view.h };
}

/** Centres the view on a world point (same size). */
export function centerOn(view, x, y, world) {
    return clampView({ ...view, x: x - view.w / 2, y: y - view.h / 2 }, world);
}
