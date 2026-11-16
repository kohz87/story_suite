// Path write: sets a value under a list of keys in a plain object, copying each object on the way.

import { FORBIDDEN } from './path-names.js';

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
