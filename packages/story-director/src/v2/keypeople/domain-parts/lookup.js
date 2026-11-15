// Story Director v2, part **keypeople**: pin and away-record lookup helpers.

import { isRecord, keyOf } from './primitives.js';
import { tables } from './state.js';

/** The names a pin goes by: its own and its aliases, as keys. */
export const keysOfPin = pin => [keyOf(pin?.name), ...(Array.isArray(pin?.aliases) ? pin.aliases.map(keyOf) : [])].filter(Boolean);

/**
 * The pinned person `name` (or any of `names`) is: `{ key, pin }`, found by their key or by an alias, or null.
 * Exact, never guessed: "Ren" is not "Renata".
 */
export function findPin(slice, ...names) {
    const wanted = names.flat().map(keyOf).filter(Boolean);
    if (!wanted.length) return null;
    const { pins } = tables(slice);
    for (const key of wanted) if (Object.hasOwn(pins, key)) return { key, pin: pins[key] };
    for (const [key, pin] of Object.entries(pins)) if (keysOfPin(pin).some(own => wanted.includes(own))) return { key, pin };
    return null;
}

/** The away record of a pinned person (found by key), or null. */
export const awayOf = (slice, key) => {
    const { away } = tables(slice);
    return Object.hasOwn(away, key) && isRecord(away[key]) ? away[key] : null;
};
