// Shared date-parsing, reach, and record-predicate helpers for relevance.

export function dateOf(record, field, { calendar, reference = null } = {}) {
    const text = record?.fields?.[field];
    if (!calendar || typeof text !== 'string' || !text.trim()) return null;
    return calendar.parse(text, { reference }) ?? null;
}

// A date without a time counts for its whole day, so "Haywane 12" is reached as soon as it
// is Haywane 12 at any hour; a date with a time is reached at that minute.
export function reachedBy(parsed, limit, calendar) {
    if (!parsed) return false;
    if (!parsed.hasTime) return calendar.dayIndex(parsed.abs) <= calendar.dayIndex(limit);
    return parsed.abs <= limit;
}

export function isActive(record) {
    return record?.status === 'active';
}

export function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
