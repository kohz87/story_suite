// Path read: resolves a parsed path in a scope, names its State pointer or keys, and reads values by key.

import { escapeKey } from '../../ops.js';
import { parsePath } from './path-syntax.js';
import { FORBIDDEN, POINTERS } from './path-names.js';

function step(value, key) {
    if (key === undefined || key === null || FORBIDDEN.has(String(key))) return undefined;
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object' && typeof value !== 'string') return undefined;
    return Object.hasOwn(value, key) ? value[key] : undefined;
}

function stepKey(scope, item) {
    if (item.key !== undefined) return item.key;
    const key = resolvePath(scope, item.path);
    return typeof key === 'string' || (typeof key === 'number' && Number.isInteger(key)) ? String(key) : undefined;
}

/** The value at a parsed path (or path text) in the scope; undefined when any step is missing. */
export function resolvePath(scope, path) {
    const parsed = typeof path === 'string' ? parsePath(path) : path;
    if (!parsed) return undefined;
    let value = step(scope, parsed.root);
    for (const item of parsed.steps) {
        value = step(value, stepKey(scope, item));
        if (value === undefined) return undefined;
    }
    return value;
}

/**
 * The JSON Pointer into the State that a path names, or null when it does not name state (a query
 * result, the draft, settings, a literal). Loop names carry their item's pointer (`withItem`).
 */
export function pointerOf(scope, path) {
    const parsed = typeof path === 'string' ? parsePath(path) : path;
    if (!parsed) return null;
    const keys = [];
    for (const item of parsed.steps) {
        const key = stepKey(scope, item);
        if (key === undefined) return null;
        keys.push(key);
    }
    let base;
    if (parsed.root === 'state') {
        if (!keys.length) return '';
        const first = keys.shift();
        base = first === 'meta' || first === 'v' ? `/${escapeKey(first)}` : `/domains/${escapeKey(first)}`;
    } else {
        base = scope?.[POINTERS]?.[parsed.root];
        if (typeof base !== 'string') return null;
    }
    return base + keys.map(key => `/${escapeKey(key)}`).join('');
}

/**
 * The keys a parsed path walks (`[root, ...steps]`), dynamic `[x.y]` steps read from the scope; null when
 * a dynamic step has no usable key.
 */
export function pathKeys(scope, path) {
    const parsed = typeof path === 'string' ? parsePath(path) : path;
    if (!parsed) return null;
    const keys = [parsed.root];
    for (const item of parsed.steps) {
        const key = stepKey(scope, item);
        if (key === undefined) return null;
        keys.push(key);
    }
    return keys;
}

/** The value under a list of keys (own properties only). */
export function valueAtKeys(target, keys) {
    let value = target;
    for (const key of keys) {
        value = step(value, key);
        if (value === undefined) return undefined;
    }
    return value;
}
