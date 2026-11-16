// Travel mode aliases, wording, and base pace lookup for atlas trips.

import { DEFAULT_PACES, MODERN_PACES } from '../../places.js';

// The words the story writes for a mode of travel (by: riding), as v1's routes.js reads them.
const ALIASES = Object.freeze({
    riding: 'ride', rides: 'ride', rider: 'ride', riders: 'ride', horse: 'ride', horseback: 'ride', mounted: 'ride', mounts: 'ride',
    walk: 'foot', walking: 'foot', walks: 'foot', hike: 'foot', hiking: 'foot', 'on foot': 'foot',
    wagons: 'wagon', cart: 'wagon', carts: 'wagon', dray: 'wagon',
    boats: 'boat', barge: 'boat', ferry: 'boat', riverboat: 'boat', keelboat: 'boat',
    ships: 'ship', sail: 'ship', sailing: 'ship',
    fly: 'flight', flying: 'flight', flies: 'flight', air: 'flight',
    couriers: 'courier', messenger: 'courier',
});
const MODERN_ALIASES = Object.freeze({
    walk: 'foot', walking: 'foot', hike: 'foot', 'on foot': 'foot', cycling: 'bike', bicycle: 'bike', drive: 'car', driving: 'car',
    taxi: 'car', coach: 'bus', rail: 'train', subway: 'metro', tram: 'metro', boat: 'ferry', fly: 'plane', flying: 'plane', flight: 'plane',
});

/** The mode a `by:` word names on this map (`ride`, `foot`, …; `car`, `train`, … on a modern map), or '' when none. */
export function modeOf(word, { modern = false } = {}) {
    const text = String(word ?? '').replace(/^\s*by\s+/i, '').trim().toLowerCase();
    if (!text) return '';
    const paces = modern ? MODERN_PACES : DEFAULT_PACES;
    if (Object.hasOwn(paces, text)) return text;
    const alias = (modern ? MODERN_ALIASES : ALIASES)[text];
    return alias && Object.hasOwn(paces, alias) ? alias : '';
}

/** "riding", "on foot", "by wagon": the mode in words. */
export function modeWords(mode) {
    return { foot: 'on foot', ride: 'riding', flight: 'by air', courier: 'by courier' }[mode] ?? `by ${mode}`;
}

/** The pace a land mode goes at on this map, per day (per hour on a modern map). */
export const basePace = (mode, modern) => (modern ? MODERN_PACES : DEFAULT_PACES)[mode] ?? null;
