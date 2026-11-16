// Story Director v2, part **cast**: collecting pinned key-people, present scene names, and reply-seen names.

import { keyOf, keysOfPerson } from '../domain.js';
import { ask } from './query.js';

/** The keys of the people the reader pinned as Key people (never moved, never met by the cast). */
export function pinnedKeys(query) {
    const pinned = new Set();
    const list = ask(query, 'director.keyPeople', {}, null);
    for (const entry of Array.isArray(list) ? list : []) {
        if (entry && typeof entry === 'object' && !entry.removed) for (const key of keysOfPerson(entry)) pinned.add(key);
    }
    return pinned;
}

/** The names of the people in the scene now (Story Block's present list, NPC State Delta's), as keys. */
export function presentKeys(query, state) {
    const out = new Set();
    const lists = [ask(query, 'scene.present', {}, null) ?? state?.domains?.scene?.present, ask(query, 'npc.present', {}, null)];
    for (const list of lists) {
        for (const entry of Array.isArray(list) ? list : []) {
            const key = keyOf(typeof entry === 'string' ? entry : entry?.name);
            if (key) out.add(key);
        }
    }
    return out;
}

/**
 * Everyone the reply's own scene lines (`+ present` lines and its own safety-net `capture.present` receipts; a place line's `with:` is not read) had in the scene at any point, as keys:
 * the added names and the list after each line. A previous reply's late lines (`assist: 'late'`) are not this reply's.
 */
export function seenKeys(receipts) {
    const out = new Set();
    for (const receipt of Array.isArray(receipts) ? receipts : []) {
        if (!receipt || receipt.type !== 'capture.present' || receipt.assist === 'late') continue;
        const data = receipt.data ?? {};
        for (const list of [data.added, data.present]) {
            for (const name of Array.isArray(list) ? list : []) {
                const key = keyOf(name);
                if (key) out.add(key);
            }
        }
    }
    return out;
}
