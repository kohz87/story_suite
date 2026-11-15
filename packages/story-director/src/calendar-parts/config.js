// Story Director: normalizing and sharing calendar configuration.
import { DEFAULT_PARTS_OF_DAY, ERA_CHARS, NAME_CHARS } from './defaults.js';
import { GREGORIAN_MONTHS, GREGORIAN_WEEK, PRESETS } from './presets.js';
import { DAY_MINUTES } from './shared-utils.js';
import { oneLine, parseWeek } from './text.js';

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

// A month may be a bare name, 'Name | days' (the settings textarea line) or { name, days }.
function toMonth(month, daysPerMonth) {
    if (typeof month === 'string') {
        const [written, days] = month.split('|');
        const name = oneLine(written, NAME_CHARS);
        return name ? { name, days: positiveInt(days, daysPerMonth) } : null;
    }
    if (month && typeof month === 'object') {
        const name = oneLine(month.name, NAME_CHARS);
        return name ? { name, days: positiveInt(month.days, daysPerMonth) } : null;
    }
    return null;
}

function toMinutes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.min(Math.max(Math.floor(value), 0), DAY_MINUTES - 1);
    const m = typeof value === 'string' && /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
    return null;
}

// Reader-given parts of day override or extend the defaults, never remove them.
function normalizeParts(parts) {
    const out = { ...DEFAULT_PARTS_OF_DAY };
    if (parts && typeof parts === 'object') {
        for (const [key, value] of Object.entries(parts)) {
            const name = key.trim().toLowerCase();
            const minutes = toMinutes(value);
            if (name && minutes !== null) out[name] = minutes;
        }
    }
    return out;
}

export function normalizeCalendar(config) {
    if (typeof config === 'string') config = PRESETS[config] ?? { preset: config };
    if (Array.isArray(config)) config = { months: config };
    if (!config || typeof config !== 'object') config = PRESETS.custom30;

    const era = typeof config.era === 'string' ? oneLine(config.era, ERA_CHARS) : '';
    const daysPerMonth = positiveInt(config.daysPerMonth ?? config.days_per_month, 30);
    const partsOfDay = normalizeParts(config.partsOfDay ?? config.parts_of_day);

    if (config.preset === 'gregorian') {
        return {
            preset: 'gregorian', era, months: GREGORIAN_MONTHS.map(m => ({ ...m })),
            daysPerMonth, leapYears: true, partsOfDay, week: [...GREGORIAN_WEEK], weekOffset: 0,
        };
    }

    let months = (Array.isArray(config.months) ? config.months : [])
        .map(month => toMonth(month, daysPerMonth))
        .filter(Boolean);
    // A calendar needs at least one month; an empty list falls back to twelve numbered ones.
    if (!months.length) months = PRESETS.custom30.months.map(m => ({ name: m.name, days: daysPerMonth }));

    const week = parseWeek(config.week);
    const offset = Math.trunc(Number(config.weekOffset) || 0);
    return {
        preset: 'custom', era, months, daysPerMonth,
        leapYears: config.leapYears === true || config.leap_years === true,
        partsOfDay,
        week, weekOffset: week.length ? ((offset % week.length) + week.length) % week.length : 0,
    };
}

/**
 * The calendar as other extensions read it (`StoryDirector.calendar()`): its era and months,
 * plain copies of any config `normalizeCalendar` accepts, so nothing the caller changes
 * reaches the reader's settings.
 */
export function sharedCalendar(config) {
    const { era, months } = normalizeCalendar(config);
    return { era, months: months.map(({ name, days }) => ({ name, days })) };
}
