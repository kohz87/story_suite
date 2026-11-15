// Read-only record lookups in a tracker by key, id, alias, or status.

import { lineKey } from '../changes.js';

/**
 * The record with this key or id (markdown and punctuation ignored), or null. (0.9.19) Failing
 * that, the record a line once reached by this name (an alias), as applyOps reads it.
 */
export function findRecord(tracker, keyOrId) {
    const id = lineKey(keyOrId);
    if (!id) return null;
    const records = tracker?.records ?? [];
    return records.find(record => record.id === id)
        ?? records.find(record => (record.aliases ?? []).includes(id))
        ?? null;
}

export function activeRecords(tracker, { kind = null } = {}) {
    return tracker.records.filter(record => record.status === 'active' && (!kind || record.kind === kind));
}
