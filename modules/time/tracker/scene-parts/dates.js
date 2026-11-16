// Story Director v2, tracker part (scene): tells whether a record's date falls within some story days.

import { dateOf, isDue } from '../../../relevance.js';

const DATE_FIELDS = ['on', 'due', 'arrive'];

/** Whether a record's `on:`/`due:`/`arrive:` falls within `days` story days of `now` (or is past). */
export function dueWithin(record, { calendar, now, days }) {
    if (!calendar || !Number.isFinite(now)) return false;
    const limit = calendar.addDays(now, days);
    return DATE_FIELDS.some(field => {
        const parsed = dateOf(record, field, { calendar, reference: now });
        if (!parsed) return false;
        return parsed.hasTime ? parsed.abs <= limit : calendar.dayIndex(parsed.abs) <= calendar.dayIndex(limit);
    });
}

export { isDue };
