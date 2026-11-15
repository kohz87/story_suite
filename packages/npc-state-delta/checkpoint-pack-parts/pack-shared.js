/* NPC State Delta small object helpers shared by checkpoint packing, patch applying and unpacking. */

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Own-property write. Plain assignment of a key named __proto__ would set the prototype instead.
export function setOwn(object, key, value) {
    Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}

// Copy of an entry with one key renamed (in the same position) and its value replaced.
export function withKey(entry, fromKey, toKey, value) {
    const result = {};
    for (const key of Object.keys(entry)) {
        if (key === fromKey) setOwn(result, toKey, value);
        else setOwn(result, key, entry[key]);
    }
    return result;
}
