// Deep equality for plain JSON. Pure.

import { isPlainObject } from './shared-shape.js';

/** Deep equality for plain JSON. */
export function equal(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => equal(item, b[i]));
    if (isPlainObject(a) && isPlainObject(b)) {
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) return false;
        for (const key of keys) if (!Object.hasOwn(b, key) || !equal(a[key], b[key])) return false;
        return true;
    }
    return false;
}
