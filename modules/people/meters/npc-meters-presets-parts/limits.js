// One meter's limits and the limits of a whole preset, cleaned to whole numbers.
import { intOr, isObject, presetSlug } from './shared-text.js';

/** One meter's limits from a record ({ ceiling, floor }, either optional): whole numbers only. */
export function normalizeLimit(raw) {
    if (!isObject(raw)) return null;
    const ceiling = intOr(raw.ceiling ?? raw.max, null);
    const floor = intOr(raw.floor ?? raw.min, null);
    const out = {};
    if (ceiling !== null) out.ceiling = Math.max(-1000, Math.min(1000, ceiling));
    if (floor !== null) out.floor = Math.max(-1000, Math.min(1000, floor));
    if (out.ceiling !== undefined && out.floor !== undefined && out.floor > out.ceiling) return null;
    return Object.keys(out).length ? out : null;
}

/** Limits by meter id: { trust: { ceiling: 60 } } (at most 24 meters; bad entries left out). */
export function normalizeLimits(raw) {
    const out = {};
    if (!isObject(raw)) return out;
    for (const [name, value] of Object.entries(raw).slice(0, 24)) {
        const id = presetSlug(name);
        const limit = normalizeLimit(value);
        if (id && limit && !['__proto__', 'constructor', 'prototype'].includes(id)) out[id] = limit;
    }
    return out;
}
