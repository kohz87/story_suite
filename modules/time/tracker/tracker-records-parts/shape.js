// Empty tracker creation, blank fields, record cloning, and alias indexing.

import { FIELDS } from '../changes.js';

export function emptyTracker() {
    return { version: 1, records: [], message: -1, time: null };
}

export function blankFields() {
    return Object.fromEntries(FIELDS.map(name => [name, '']));
}

export function cloneRecord(record) {
    return {
        ...record,
        fields: { ...record.fields },
        extra: { ...record.extra },
        created: { ...record.created },
        changed: { ...record.changed },
        seen: { ...record.seen },
        resolved: record.resolved ? { ...record.resolved } : null,
        legSince: record.legSince ? { ...record.legSince } : null,
        // (0.9.19) A tracker saved before aliases has none.
        aliases: [...(record.aliases ?? [])],
        // History entries are never edited, only appended, so they can be shared.
        history: [...record.history],
    };
}

// (0.9.19) The names records were once reached by (their aliases), each to its record's
// index: a name that is a record's own id is that record's, and a name two records hold
// belongs to the first in tracker order, so a replay always reads it the same way.
export function aliasIndexOf(records, indexById) {
    const index = new Map();
    records.forEach((record, at) => {
        for (const alias of record.aliases ?? []) {
            if (!indexById.has(alias) && !index.has(alias)) index.set(alias, at);
        }
    });
    return index;
}
