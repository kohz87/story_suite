// Converting between client pixels, world units and stage percentages.

import { round } from './shared-round.js';

/** The world point under a client (pixel) position on the stage. */
export function clientToWorld(view, rect, clientX, clientY) {
    return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.w,
        y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
}

/** World units per pixel (horizontal and vertical) for a stage of `rect`. */
export function unitsPerPixel(view, rect) {
    return { x: view.w / rect.width, y: view.h / rect.height };
}

/** Where a world point sits on the stage, in percent of its width and height. */
export function toPercent(view, x, y) {
    return { left: round(((x - view.x) / view.w) * 100), top: round(((y - view.y) / view.h) * 100) };
}
