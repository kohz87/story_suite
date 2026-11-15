// Normalized JSON of a plain value and its hash (the contract's Hash).

import { sha256 } from './sha256.js';
import { isObject } from './shared-object.js';

// ---------- normalized JSON ----------

/**
 * The normalized JSON of a value: object keys sorted, array order kept, no spaces. Plain JSON only (a number
 * that is not finite, undefined, a function or a class instance throws), so a hash never depends on what
 * JSON.stringify would quietly drop.
 */
export function canonicalJson(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError(`${value} cannot be hashed; only plain JSON can.`);
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
    if (isObject(value)) {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) throw new TypeError('Only plain JSON can be hashed.');
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    throw new TypeError(`A ${typeof value} cannot be hashed; only plain JSON can.`);
}

/** SHA-256 of the normalized JSON of `value` (the contract's Hash). */
export const hashJson = value => sha256(canonicalJson(value));

/** True for a plain-JSON value (hashJson would accept it). */
export function isPlainJson(value) {
    try { canonicalJson(value); return true; } catch { return false; }
}
