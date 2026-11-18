// World bounds of points, the fitted view, view aspect changes and the zoom level.

import { DEFAULT_ASPECT } from './limits.js';

const EMPTY_SPAN = 100;

/** World bounds of points, padded by 15% of the larger side (a lone point gets a 100-unit square first). */
export function worldBounds(points) {
    if (!points.length) return { x: -EMPTY_SPAN / 2, y: -EMPTY_SPAN / 2, w: EMPTY_SPAN, h: EMPTY_SPAN };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { x, y } of points) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX === minX && maxY === minY) {
        minX -= EMPTY_SPAN / 2; maxX += EMPTY_SPAN / 2;
        minY -= EMPTY_SPAN / 2; maxY += EMPTY_SPAN / 2;
    }
    const span = Math.max(maxX - minX, maxY - minY);
    const pad = span * 0.15;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/** The view that shows the whole world at the given aspect, centred. */
export function fitView(world, aspect = DEFAULT_ASPECT) {
    const a = aspect > 0 && Number.isFinite(aspect) ? aspect : DEFAULT_ASPECT;
    const w = world.w / world.h > a ? world.w : world.h * a;
    const h = w / a;
    return { x: world.x + world.w / 2 - w / 2, y: world.y + world.h / 2 - h / 2, w, h };
}

/** The same view (same centre and width) at a new aspect. */
export function withAspect(view, aspect) {
    if (!(aspect > 0) || !Number.isFinite(aspect)) return view;
    const h = view.w / aspect;
    return { x: view.x, y: view.y + view.h / 2 - h / 2, w: view.w, h };
}

/** Zoom level relative to "fit": 1 shows the whole world, 2 is twice as close. */
export function zoomLevel(view, world, aspect) {
    return fitView(world, aspect).w / view.w;
}
