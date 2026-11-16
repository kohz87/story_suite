// Defensive deep copies of plain JSON. Pure.

import { setKey } from './shared-shape.js';

/**
 * A deep copy of plain JSON (other values are kept as they are, for checkOps to report). An object
 * without a prototype (a change line's labels) stays one, so a key it lacks is never an inherited one.
 */
export function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out = proto === null ? Object.create(null) : {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const item = value[key];
        setKey(out, key, item === null || typeof item !== 'object' ? item : clone(item));
    }
    return out;
}
