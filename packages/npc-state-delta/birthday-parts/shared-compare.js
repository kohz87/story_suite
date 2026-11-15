// Birthday shared helpers: identity text, same-date and same-month-day comparison, exact age parsing.
import {
    normalizeCalendarDate,
} from '../calendar.js';

export function normalizedIdentity(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function sameDate(a, b, config = null) {
    const left = normalizeCalendarDate(a, config);
    const right = normalizeCalendarDate(b, config);
    if (!left || !right) return false;
    return String(left.era || '') === String(right.era || '')
        && left.year === right.year
        && normalizedIdentity(left.month) === normalizedIdentity(right.month)
        && left.day === right.day;
}

export function sameMonthDay(a, b, config = null) {
    const left = normalizeCalendarDate(a, config);
    const right = normalizeCalendarDate(b, config);
    if (!left || !right) return false;
    return normalizedIdentity(left.month) === normalizedIdentity(right.month) && left.day === right.day;
}

export function exactAge(value) {
    const text = String(value ?? '').trim();
    return /^\d{1,3}$/.test(text) ? Number(text) : null;
}
