// Pans, zooms, and centres the map view within bounds and zoom limits.

import { clamp } from './shared-math.js';
import { clampView, toMap } from './transform.js';

/** Zooms by `factor` (> 1 is closer) keeping the stage point (sx, sy) on the same map point. */
export function zoomAt(view, factor, sx, sy, width, height, box, limits) {
    const k = clamp(view.k * factor, limits.min, limits.max);
    const at = toMap(view, width, height, sx, sy);
    return clampView({ cx: at.x - (sx - width / 2) / k, cy: at.y - (sy - height / 2) / k, k }, box, limits);
}

/** Moves the view by (dx, dy) stage pixels (a drag to the right shows what is to the left). */
export const panBy = (view, dx, dy, box, limits) => clampView({ cx: view.cx - dx / view.k, cy: view.cy - dy / view.k, k: view.k }, box, limits);

/** The view centred on a map-space point, zoomed to at least `k` (inside the limits). */
export const centreOn = (view, point, box, limits, k = view.k) => clampView({ cx: point.x, cy: point.y, k: Math.max(view.k, k) }, box, limits);

/** How close a view is, relative to "fit" (1 = the whole layer). */
export const zoomLevel = (view, fitK) => (fitK > 0 ? view.k / fitK : 1);
