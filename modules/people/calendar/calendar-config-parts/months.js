/* Month-definition parsing and rendering for the calendar configuration, with the month and day-count limits. */

import { cleanText, normalizeMonthKey } from './shared-text.js';

export const MAX_CALENDAR_MONTHS = 64;
export const MAX_CALENDAR_DAYS_PER_MONTH = 999;

function normalizedMonthsFromArray(value) {
    if (!Array.isArray(value)) return { months: [], errors: [] };
    const errors = [];
    const months = [];
    const seen = new Set();
    for (const raw of value.slice(0, MAX_CALENDAR_MONTHS + 1)) {
        const name = cleanText(raw?.name ?? raw?.month, 80);
        const days = Number(raw?.days ?? raw?.endDay ?? raw?.end_day);
        const key = normalizeMonthKey(name);
        if (!name) { errors.push('Month name cannot be blank.'); continue; }
        if (!Number.isInteger(days) || days < 1 || days > MAX_CALENDAR_DAYS_PER_MONTH) {
            errors.push(`${name}: days must be an integer from 1 to ${MAX_CALENDAR_DAYS_PER_MONTH}.`);
            continue;
        }
        if (seen.has(key)) { errors.push(`Duplicate month name: ${name}.`); continue; }
        seen.add(key);
        months.push({ name, days });
    }
    if (value.length > MAX_CALENDAR_MONTHS) errors.push(`Calendar supports at most ${MAX_CALENDAR_MONTHS} months.`);
    return { months, errors };
}

export function parseMonthDefinitions(value) {
    if (Array.isArray(value)) return normalizedMonthsFromArray(value);
    const text = String(value ?? '').replace(/\r/g, '');
    if (!text.trim()) return { months: [], errors: ['At least one month is required.'] };
    const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];
    for (const row of rows.slice(0, MAX_CALENDAR_MONTHS + 1)) {
        const match = row.match(/^([^:]+?)\s*:\s*(\d{1,4})$/);
        if (!match) {
            errors.push(`Invalid month row: ${row}. Use Month name:days.`);
            continue;
        }
        parsed.push({ name: match[1].trim(), days: Number(match[2]) });
    }
    if (rows.length > MAX_CALENDAR_MONTHS) errors.push(`Calendar supports at most ${MAX_CALENDAR_MONTHS} months.`);
    const normalized = normalizedMonthsFromArray(parsed);
    return { months: normalized.months, errors: [...errors, ...normalized.errors] };
}

export function monthDefinitionsText(months = []) {
    return normalizedMonthsFromArray(months).months.map(month => `${month.name}:${month.days}`).join('\n');
}
