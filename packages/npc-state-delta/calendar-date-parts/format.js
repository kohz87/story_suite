/* Date presentation: formats a calendar date as text and reads the configured current date. */

import { normalizeCalendarConfig } from '../calendar-config.js';
import { normalizeCalendarDate } from './parse.js';

export function formatCalendarDate(value, config = null) {
    const date = normalizeCalendarDate(value, config);
    if (!date) return '';
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid && /^\d{2}$/.test(date.month)) {
        const md = `${date.month}-${String(date.day).padStart(2, '0')}`;
        return date.year === null ? md : `${String(date.year).padStart(4, '0')}-${md}`;
    }
    const monthDay = `${date.month} ${date.day}`;
    if (date.year === null) return monthDay;
    const era = date.era || normalized.config.era || '';
    return `${era}${date.year}, ${monthDay}`;
}

export function currentCalendarDate(config = null) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.valid || !normalized.currentDateValid) return null;
    return {
        era: normalized.config.era,
        year: normalized.config.currentYear,
        month: normalized.config.currentMonth,
        day: normalized.config.currentDay,
    };
}
