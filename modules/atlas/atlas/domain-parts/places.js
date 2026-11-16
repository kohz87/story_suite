// Atlas place lookup, deterministic ordering, and child coordinate offsets.

import { keyOf } from './text.js';

/** The place `ref` names: an id, or a name or alias. Null when none. */
export function findPlace(atlas, ref) {
    if (!atlas || ref === null || ref === undefined) return null;
    const text = String(ref);
    if (Object.hasOwn(atlas.places ?? {}, text)) return atlas.places[text];
    const id = atlas.keys?.[keyOf(text)];
    return id && Object.hasOwn(atlas.places ?? {}, id) ? atlas.places[id] : null;
}

/** Places in a fixed order (the same however and whenever they were touched): by name, then id. */
export function orderedPlaces(atlas) {
    return Object.values(atlas?.places ?? {}).sort((a, b) => keyOf(a.name).localeCompare(keyOf(b.name)) || (a.id < b.id ? -1 : 1));
}

// A rounded number: coordinates stay the same across engines and reads.
export const round3 = value => Math.round(value * 1000) / 1000;

/**
 * The offset `{ dx, dy }` of a child from its parent's point, for the child's key (`keyOf` of its name). Deterministic: FNV-1a of the
 * key picks the angle and the ring (0.3, 0.4 or 0.5 units; the pack's districts sit a few tenths apart). Same key, same offset, on every
 * read and replay.
 */
export function childOffset(key) {
    let hash = 0x811c9dc5;
    for (const char of String(key ?? '')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const angle = (hash / 4294967296) * 2 * Math.PI;
    const radius = 0.3 + ((hash >>> 8) % 3) * 0.1;
    return { dx: round3(Math.cos(angle) * radius), dy: round3(Math.sin(angle) * radius) };
}
