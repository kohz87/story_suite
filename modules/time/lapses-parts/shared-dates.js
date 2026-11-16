// Story Director: shared deadline-end helpers for slipped beats and lapsed offers.
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);

// The last minute a date counts for: a date without a time runs to the end of its day, the
// way deadlines are counted (calendar.withClock, the Quests tab).
function endOf(parsed, calendar) {
    return parsed.hasTime ? parsed.abs : calendar.addDays(parsed.abs, 1) - 1;
}

export function dateEnd(record, field, { calendar, now }) {
    const text = String(record?.fields?.[field] ?? '').trim();
    if (!text) return null;
    const parsed = calendar.parse(text, { reference: now });
    return parsed && isNumber(parsed.abs) ? endOf(parsed, calendar) : null;
}
