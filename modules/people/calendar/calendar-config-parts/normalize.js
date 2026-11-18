/* Calendar configuration normalization: validates months, era and the manual current date into one normalized config. */

import { cleanText, normalizeMonthKey, parseInteger } from './shared-text.js';
import { parseMonthDefinitions } from './months.js';

export function normalizeCalendarConfig(raw = {}, { requireCurrentDate = false } = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const monthSource = source.months ?? source.monthDefinitions ?? source.month_definitions ?? source.monthsText ?? source.months_text;
    const parsed = parseMonthDefinitions(monthSource);
    const errors = [...parsed.errors];
    const calendarValid = parsed.months.length > 0 && parsed.errors.length === 0;

    const era = cleanText(source.era, 40);
    const yearRaw = source.currentYear ?? source.current_year ?? source.year;
    const monthRaw = source.currentMonth ?? source.current_month ?? source.month;
    const dayRaw = source.currentDay ?? source.current_day ?? source.day;
    const yearProvided = yearRaw !== null && yearRaw !== undefined && String(yearRaw).trim() !== '';
    const requestedMonth = cleanText(monthRaw, 80);
    const monthProvided = Boolean(requestedMonth);
    const dayProvided = dayRaw !== null && dayRaw !== undefined && String(dayRaw).trim() !== '';
    const anyCurrentDatePart = yearProvided || monthProvided || dayProvided;

    const currentYear = yearProvided ? parseInteger(yearRaw) : null;
    const requestedMonthKey = normalizeMonthKey(requestedMonth);
    const currentMonthRecord = parsed.months.find(month => normalizeMonthKey(month.name) === requestedMonthKey) || null;
    const currentDayRaw = dayProvided ? Number(dayRaw) : null;
    const currentDay = Number.isInteger(currentDayRaw) ? currentDayRaw : null;

    if (requireCurrentDate || anyCurrentDatePart) {
        if (!yearProvided) errors.push('Current year is required when a manual current date is set.');
        else if (currentYear === null) errors.push('Current year must be an integer.');
        if (!requestedMonth) errors.push('Current month is required when a manual current date is set.');
        else if (calendarValid && !currentMonthRecord) errors.push(`Current month is not in the configured month list: ${requestedMonth}.`);
        if (!dayProvided) errors.push('Current day is required when a manual current date is set.');
        else if (currentDay === null) errors.push('Current day must be an integer.');
        else if (currentMonthRecord && (currentDay < 1 || currentDay > currentMonthRecord.days)) {
            errors.push(`${currentMonthRecord.name} has days 1-${currentMonthRecord.days}; ${currentDay} is invalid.`);
        }
    }

    const currentDateValid = calendarValid
        && currentYear !== null
        && Boolean(currentMonthRecord)
        && currentDay !== null
        && currentDay >= 1
        && currentDay <= currentMonthRecord.days;

    return {
        valid: calendarValid && errors.length === 0 && (!requireCurrentDate || currentDateValid),
        calendarValid,
        currentDateValid,
        currentDateConfigured: anyCurrentDatePart,
        errors,
        config: {
            era,
            currentYear,
            currentMonth: currentMonthRecord?.name || requestedMonth,
            currentDay,
            months: parsed.months,
        },
    };
}
