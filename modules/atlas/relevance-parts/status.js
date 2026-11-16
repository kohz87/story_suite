// Checks whether active records are due, arriving, or dormant.

import { DEFAULTS } from './defaults.js';
import { dateOf, isActive, isNumber, reachedBy } from './shared-dates.js';

// Fields that hold a date the story can reach.
const DATE_FIELDS = ['on', 'due', 'arrive'];
const FIRE_FIELDS = ['on', 'due'];
const DAY_MINUTES = 1440;

function anyReached(record, fields, limit, { calendar, now }) {
    if (!calendar || !isNumber(limit) || !isNumber(now)) return false;
    return fields.some(field => reachedBy(dateOf(record, field, { calendar, reference: now }), limit, calendar));
}

export function isDue(record, { calendar, now }) {
    if (!isActive(record)) return false;
    return anyReached(record, FIRE_FIELDS, now, { calendar, now });
}

export function isArriving(record, { calendar, now }) {
    if (!isActive(record)) return false;
    return anyReached(record, ['arrive'], now, { calendar, now });
}

// Something due (or overdue) within dueSoonDays keeps a record awake.
function dueSoon(record, { calendar, now, days }) {
    if (!calendar || !isNumber(now)) return false;
    return anyReached(record, DATE_FIELDS, calendar.addDays(now, days), { calendar, now });
}

export function isDormant(record, { calendar, now = null, message = null, settings = DEFAULTS } = {}) {
    if (!isActive(record) || record.pinned) return false;
    const { dormantReplies, dormantDays, dueSoonDays } = { ...DEFAULTS, ...settings };
    if (dueSoon(record, { calendar, now, days: dueSoonDays })) return false;

    const seen = record.seen ?? {};
    const quietReplies = isNumber(message) && isNumber(seen.message) && message - seen.message >= dormantReplies;
    const quietDays = isNumber(now) && isNumber(seen.time) && (now - seen.time) / DAY_MINUTES >= dormantDays;
    return quietReplies || quietDays;
}
