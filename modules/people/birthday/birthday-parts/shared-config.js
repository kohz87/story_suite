// Birthday shared helpers: the active-or-provided calendar config and the grounded reference date.
import {
    getActiveCalendarConfig,
    normalizeCalendarDate,
    storyCurrentDate,
} from '../../legacy/calendar.js';

export function activeOrProvided(config = undefined) {
    return config === undefined ? getActiveCalendarConfig() : config;
}

export function groundedReferenceDate(calendar, referenceDate = null) {
    return normalizeCalendarDate(referenceDate, calendar) || storyCurrentDate(calendar);
}
