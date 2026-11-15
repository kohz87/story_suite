// Story Director v2, tracker part (note): takes the encounter field out of a tracker when no fight runner is present.

/** A v1 tracker with no record's `encounter` told (no fight runner): the field stays on the thread. */
export function withoutEncounters(tracker) {
    return { ...tracker, records: tracker.records.map(record => (record.fields?.encounter ? { ...record, fields: { ...record.fields, encounter: '' } } : record)) };
}
