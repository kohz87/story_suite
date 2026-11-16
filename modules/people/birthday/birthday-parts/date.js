// Birth date normalizing, formatting and precision.
import {
    formatCalendarDate,
    normalizeCalendarDate,
} from '../../legacy/calendar.js';
import { activeOrProvided } from './shared-config.js';

export function normalizeBirthDate(value, config = undefined) {
    return normalizeCalendarDate(value, activeOrProvided(config));
}

export function normalizeStoredBirthDate(value, config = undefined) {
    const calendar = activeOrProvided(config);
    return normalizeCalendarDate(value, calendar) || normalizeCalendarDate(value, null);
}

export function formatBirthDate(value, config = undefined) {
    const calendar = activeOrProvided(config);
    const normalized = normalizeCalendarDate(value, calendar) || normalizeCalendarDate(value, null);
    if (!normalized) return '';
    return formatCalendarDate(normalized, normalizeCalendarDate(value, calendar) ? calendar : null);
}

export function birthDatePrecision(value, config = undefined) {
    const normalized = normalizeBirthDate(value, config);
    return normalized ? (normalized.year === null ? 'month-day' : 'full') : '';
}
