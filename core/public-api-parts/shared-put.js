// Adds one path and value to a section's map of public paths.

import { isObject, fold } from './shared-basics.js';

// ---- the readers: one section of the public paths from a state -------------------------------------------------------------------------------

// A section is a Map of folded path → { path, value, leaf }: `leaf` entries are the values the diff compares; the others are groups (a list or an
// object that holds leaves). `alias` entries (party.me.*) point at a member's own path and are not diffed.
// An object value (a map field) is a group: its per-key leaves are what the diff compares, so a change is reported once.
export function put(map, path, value, leaf = true, alias = false) {
    if (value === undefined) return;
    map.set(fold(path), { path, value, leaf: leaf && !isObject(value), alias });
}
