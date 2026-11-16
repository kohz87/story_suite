// Icons: reads a `ph-name[:fill]` id into { id, weight } against the icon set.

import { ICON_SET } from '../set.js';

export const WEIGHTS = Object.freeze(['regular', 'fill']);

/** { id, weight } for `ph-name` or `ph-name:fill`; null when it is not a `ph-*` id of the set. */
export function parse(value) {
    if (typeof value !== 'string') return null;
    const [id, weight = 'regular', ...rest] = value.trim().split(':');
    if (rest.length || !WEIGHTS.includes(weight) || !Object.hasOwn(ICON_SET, id)) return null;
    return { id, weight };
}
