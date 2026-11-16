// Route travel modes, per-route day calculation, and default trip mode.

import { DEFAULT_PACES, MODERN_PACES, mapSettings } from '../../../places.js';
import { DEFAULT_RULES, MODERN_RULES, legDays } from '../../../routes.js';
import { tidy } from './shared-math.js';

// The mode a route of this kind is travelled by, whatever the trip's own.
const WATER = /\b(?:river|canal|stream|lake|ferry|boat|barge|water)\b/;
const SEA = /\b(?:sea|ocean|lane|ship|voyage)\b/;
const AIR = /\b(?:air|sky|flight|fly)\b/;

/** The trip's mode on a route of `kind`: { mode, pace } at v1's paces, or null. */
export function hopMode(kind, mode, { modern = false } = {}) {
    const paces = modern ? MODERN_PACES : DEFAULT_PACES;
    const word = String(kind ?? '').toLowerCase();
    const by = AIR.test(word) ? (modern ? 'plane' : 'flight')
        : SEA.test(word) ? 'ship'
            : WATER.test(word) ? (modern ? 'ferry' : 'boat')
                : mode;
    return Object.hasOwn(paces, by) ? { mode: by, pace: paces[by] } : null;
}

/** Days for one route: its hours, else its km at the pace; null when neither is known. */
export function routeDays(route, mode, { modern = false } = {}) {
    if (route.hours !== null && route.hours !== undefined) return tidy(route.hours / 24);
    if (!(route.km > 0)) return null;
    const by = hopMode(route.kind, mode, { modern });
    return by ? legDays(route.km, by.pace, modern ? MODERN_RULES : DEFAULT_RULES) : null;
}

/** The trip's default mode: on foot, or by car on a modern map. */
export const defaultMode = map => (mapSettings(map).era === 'modern' ? 'car' : 'foot');
