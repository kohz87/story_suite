/* Calendar identity: the fingerprint string and the year length of a configured calendar. */

import { normalizeMonthKey } from './shared-text.js';
import { normalizeCalendarConfig } from './normalize.js';

export const LEGACY_NUMERIC_CALENDAR_ID = 'legacy-numeric-v1';

export function calendarFingerprint(config = null) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) return LEGACY_NUMERIC_CALENDAR_ID;
    return [`era:${normalizeMonthKey(normalized.config.era)}`, ...normalized.config.months
        .map(month => `${normalizeMonthKey(month.name)}:${month.days}`)]
        .join('|');
}

export function calendarYearLength(config = null) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) return 365;
    return normalized.config.months.reduce((total, month) => total + month.days, 0);
}
