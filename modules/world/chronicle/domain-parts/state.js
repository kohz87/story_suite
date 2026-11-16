// Chronicle's empty shape and the reads and edits of its per-reply pick bookkeeping.

import { slotValue, toSlot } from '../../../../packages/story-director/src/v2/slot.js';
import { isRecord } from './shared-basics.js';

export function initialChronicle() {
    return { events: {}, factions: {}, seen: toSlot({}), seenAt: {}, round: 0, surfaced: null, days: {}, written: null, dayFacts: {}, noted: null, questLog: {} };
}

/** The round each event was last in the tail: `seenAt`, over an older chat's `seen` (a slot, or bare). */
export const seenOf = chronicle => ({ ...(slotValue(chronicle?.seen) ?? {}), ...(isRecord(chronicle?.seenAt) ? chronicle.seenAt : {}) });

/** The pick for the reply being written (`surfaced`), or null. */
export const surfacedOf = chronicle => slotValue(chronicle?.surfaced);

/** Drops `id` from `seenAt` (a draft) by its key; nothing when it is not there (an older chat's `seen` stays as it is). */
export function forgetSeen(chronicle, id) {
    if (isRecord(chronicle?.seenAt) && Object.hasOwn(chronicle.seenAt, id)) delete chronicle.seenAt[id];
}
