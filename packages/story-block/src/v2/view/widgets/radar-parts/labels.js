// The radar's axis label size: never smaller than a minimum on screen.

import { VIEW_WIDTH } from './shared-geometry.js';

export const LABEL_MIN_PX = 11;

/**
 * The axis label size in the chart's own units for a chart drawn `width` px wide: LABEL_MIN_PX units
 * (which grow with a big chart), more when the chart is drawn small, so a label never shows under
 * LABEL_MIN_PX on screen.
 */
export function labelUnits(width) {
    if (!(Number.isFinite(width) && width > 0)) return LABEL_MIN_PX;
    return Math.max(LABEL_MIN_PX, Math.ceil((LABEL_MIN_PX * VIEW_WIDTH / width) * 10) / 10);
}
