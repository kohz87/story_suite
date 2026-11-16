// The memory of the last absence and what the dossier, cards and narrator show for one key person.

import { RECENT_REPLIES } from './constants.js';
import { findKeyEntry, isKey } from './entries.js';
import { labelKey, isObject } from './shared-text.js';

// ---- the memory of the last absence ----

/** The key of a key person in the slice's `keyAway` (their name as comparison words joined by "-"). */
export function memoryKey(name) {
    return labelKey(name).replace(/ /g, '-').slice(0, 60);
}

/**
 * What the dossier, the cards and the narrator show for one dossier, or null when the person is not a key
 * person: { name, here, away: {…} | null, recent: { away, justReturned } | null }. `recent` is the last absence of
 * someone who has come back and has not yet been present for a few replies; `justReturned` is true at the reply
 * the return was noticed (the narrator is told then, once: when the next reply starts the head has moved on).
 */
export function keyView(list, memory, npc, head) {
    const entry = findKeyEntry(list, npc);
    if (!isKey(entry)) return null;
    const view = { name: entry.name, here: entry.here, away: entry.away ?? null, recent: null };
    const kept = isObject(memory) ? memory[memoryKey(entry.name)] : null;
    if (!entry.away && isObject(kept) && kept.away && Number.isInteger(kept.returnedAt) && Number.isInteger(head) && head >= kept.returnedAt
        && (kept.presentReplies ?? 0) < RECENT_REPLIES) {
        view.recent = { away: kept.away, justReturned: head === kept.returnedAt };
    }
    return view;
}
