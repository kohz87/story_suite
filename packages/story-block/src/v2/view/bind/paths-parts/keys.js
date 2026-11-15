// Reads and copy-writes values under a list of keys, own properties only.

import { FORBIDDEN, step } from './shared-step.js';

/** The value under a list of keys (own properties only). */
export function valueAtKeys(target, keys) {
    let value = target;
    for (const key of keys) {
        value = step(value, key);
        if (value === undefined) return undefined;
    }
    return value;
}

/** Set a value under a list of keys inside a plain object, copying each object on the way. */
export function setIn(target, keys, value) {
    if (!Array.isArray(keys) || !keys.length || keys.some(key => typeof key !== 'string' || FORBIDDEN.has(key))) {
        throw new Error(`"${Array.isArray(keys) ? keys.join('.') : keys}" cannot be written.`);
    }
    const write = (node, index) => {
        const copy = Array.isArray(node) ? [...node] : node && typeof node === 'object' ? { ...node } : {};
        const key = keys[index];
        copy[key] = index === keys.length - 1 ? value : write(Object.hasOwn(copy, key) ? copy[key] : undefined, index + 1);
        return copy;
    };
    return write(target, 0);
}
