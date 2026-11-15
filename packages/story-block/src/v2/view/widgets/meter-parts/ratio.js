// The meter's fill ratio and the full/partly-full cells of a segmented bar.

import { clamp } from '../dom.js';

/** The fill ratio in [0, 1] (0 when the range is empty). */
export function meterRatio(value, min, max) {
    const span = max - min;
    if (!(span > 0)) return 0;
    return clamp((value - min) / span, 0, 1);
}

/** How many of `segments` cells are full, and whether the next one is partly full. */
export function meterCells(ratio, segments) {
    const exact = ratio * segments;
    const full = Math.floor(exact + 1e-9);
    return { full, part: full < segments && exact - full > 1e-9 };
}
