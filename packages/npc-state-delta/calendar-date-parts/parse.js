/* Date parsing: turns objects and text into a normalized calendar date, with the regex escaper it uses. */

import { cleanText, MAX_CALENDAR_DAYS_PER_MONTH, normalizeCalendarConfig, normalizeMonthKey, parseInteger } from '../calendar-config.js';
import { legacyMonthDays } from './shared-legacy-days.js';

function normalizeDateObject(value, config = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const era = cleanText(value.era, 40);
    const yearRaw = value.year;
    const year = yearRaw === null || yearRaw === undefined || yearRaw === '' ? null : parseInteger(yearRaw);
    const month = cleanText(value.month, 80);
    const day = Number(value.day);
    if (!month || !Number.isInteger(day) || day < 1 || day > MAX_CALENDAR_DAYS_PER_MONTH) return null;
    if (yearRaw !== null && yearRaw !== undefined && yearRaw !== '' && year === null) return null;

    const normalizedConfig = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (normalizedConfig.calendarValid) {
        const monthRecord = normalizedConfig.config.months.find(item => normalizeMonthKey(item.name) === normalizeMonthKey(month));
        if (!monthRecord || day > monthRecord.days) return null;
        return { era, year, month: monthRecord.name, day };
    }

    if (/^\d{1,2}$/.test(month)) {
        const monthNumber = Number(month);
        if (monthNumber < 1 || monthNumber > 12 || day > legacyMonthDays(monthNumber, year)) return null;
        return { era, year, month: String(monthNumber).padStart(2, '0'), day };
    }
    return { era, year, month, day };
}

function parseConfiguredMonthDay(text, config) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) return null;
    const sorted = [...normalized.config.months].sort((a, b) => b.name.length - a.name.length);
    const lower = text.toLocaleLowerCase();
    for (const month of sorted) {
        const name = month.name.toLocaleLowerCase();
        if (!lower.startsWith(name)) continue;
        const rest = text.slice(month.name.length).trim().replace(/^[:\-/]\s*/, '');
        if (!/^\d{1,4}$/.test(rest)) continue;
        const day = Number(rest);
        if (day < 1 || day > month.days) return null;
        return { month: month.name, day };
    }
    return null;
}

function parseYearLabel(value, config = null) {
    const text = cleanText(value, 80);
    if (!text) return { era: '', year: null };
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    const configuredEra = normalized.config.era;
    if (configuredEra && text.toLocaleLowerCase().startsWith(configuredEra.toLocaleLowerCase())) {
        const year = parseInteger(text.slice(configuredEra.length));
        if (year !== null) return { era: configuredEra, year };
    }
    const bare = parseInteger(text);
    if (bare !== null) return { era: configuredEra || '', year: bare };
    const match = text.match(/^(.*?)(-?\d{1,7})$/);
    if (!match) return { era: '', year: null };
    const year = parseInteger(match[2]);
    return year === null ? { era: '', year: null } : { era: cleanText(match[1], 40), year };
}

export function escapeRegex(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeCalendarDate(value, config = null) {
    const fromObject = normalizeDateObject(value, config);
    if (fromObject) return fromObject;
    const text = cleanText(value, 180);
    if (!text) return null;

    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (normalized.calendarValid) {
        const comma = text.lastIndexOf(',');
        if (comma >= 0) {
            const datePart = parseConfiguredMonthDay(text.slice(comma + 1).trim(), normalized.config);
            const yearPart = parseYearLabel(text.slice(0, comma).trim(), normalized.config);
            if (datePart && yearPart.year !== null) return { ...yearPart, ...datePart };
        }
        const sorted = [...normalized.config.months].sort((a, b) => b.name.length - a.name.length);
        for (const month of sorted) {
            const match = text.match(new RegExp(`^(.*?)\\s*,?\\s*${escapeRegex(month.name)}\\s+(\\d{1,4})$`, 'iu'));
            if (!match) continue;
            const yearPart = parseYearLabel(match[1].trim(), normalized.config);
            const day = Number(match[2]);
            if (yearPart.year !== null && day >= 1 && day <= month.days) return { ...yearPart, month: month.name, day };
        }
        const datePart = parseConfiguredMonthDay(text, normalized.config);
        if (datePart) return { era: '', year: null, ...datePart };
        return null;
    }

    let match = text.match(/^(-?\d{1,7})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) return normalizeDateObject({ year: match[1], month: match[2], day: Number(match[3]) }, null);
    match = text.match(/^(\d{1,2})[-/](\d{1,2})$/);
    if (match) return normalizeDateObject({ year: null, month: match[1], day: Number(match[2]) }, null);
    return normalizeDateObject(value, null);
}
