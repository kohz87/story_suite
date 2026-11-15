// The map's places: read them from query rows, and find the one a name means exactly (with the spellings it answers to).

import { fold, number } from './shared-text.js';

/**
 * The places the map has, read from queries' rows (`{ name, aliases?, region?, x?, y? }`; the atlas's and the packs'), as a
 * list without repeats (by name, case and apostrophes ignored): `[{ name, aliases, region, x, y }]`.
 */
export function mapPlaces(...lists) {
    const seen = new Map();
    for (const list of lists) {
        for (const row of Array.isArray(list) ? list : []) {
            const name = typeof row?.name === 'string' ? row.name.replace(/\s+/g, ' ').trim() : '';
            if (!name || seen.has(fold(name))) continue;
            const aliases = (Array.isArray(row.aliases) ? row.aliases : []).filter(alias => typeof alias === 'string' && alias.trim()).map(alias => alias.trim());
            seen.set(fold(name), { name, aliases, region: typeof row.region === 'string' ? row.region.trim() : '', x: number(row.x), y: number(row.y) });
        }
    }
    return [...seen.values()];
}

// Every spelling the map answers to for one place: its name and aliases, then each side of "Village / Spot".
export const whole = place => new Set([place.name, ...place.aliases].map(fold));
export const sides = place => new Set([place.name, ...place.aliases].flatMap(text => String(text).split(/\s[\/|]\s|\s—\s/)).map(fold).filter(Boolean));

/** The place of `places` a name means exactly (its name or an alias first, then a side of "A / B"), or null. */
export function knownPlace(places, name) {
    const key = fold(name);
    if (!key) return null;
    return places.find(place => whole(place).has(key)) ?? places.find(place => sides(place).has(key)) ?? null;
}
