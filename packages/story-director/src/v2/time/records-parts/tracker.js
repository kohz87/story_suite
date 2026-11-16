// Threads in tracker order, and the v1 tracker they read as.

import { isInt } from './shared-int.js';
import { recordOf } from './reading.js';

/** Threads in tracker order: by `track.order`, then by id (the tracker part's order). */
export function orderedThreads(director) {
    return Object.values(director?.threads ?? {}).sort((a, b) =>
        (a.track?.order ?? 0) - (b.track?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The v1 tracker the domain reads as, and which thread each record is:
 * `{ tracker: { version, records, message, time }, threadOf: Map(record → thread) }`.
 * `only`: which threads to read (default: the active ones). `fights: false` (no module runs fights,
 * WAVE rule 11): no record tells its `encounter` (it stays on the thread).
 */
export function trackerOf(director, { calendar = null, now = null, only = thread => thread.status === 'active', fights = true } = {}) {
    const threadOf = new Map();
    const records = [];
    for (const thread of orderedThreads(director)) {
        if (!only(thread)) continue;
        const record = recordOf(thread, { calendar });
        if (!fights && record.fields.encounter) record.fields = { ...record.fields, encounter: '' };
        threadOf.set(record, thread);
        records.push(record);
    }
    return {
        tracker: { version: 1, records, message: director?.turn?.n ?? -1, time: isInt(now) ? now : director?.time?.minutes ?? null },
        threadOf,
    };
}
