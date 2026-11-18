/* Deterministic birthdays: a stable hash of a seed mapped onto a day of the configured year. */

import { calendarYearLength, normalizeCalendarConfig } from '../calendar-config.js';
import { legacyMonthDays } from '../calendar-date.js';

function stableHash(value) {
    const text = String(value || '').normalize('NFKC').toLocaleLowerCase();
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

export function deterministicCalendarBirthday(seed, config = null) {
    const key = String(seed || '').trim();
    if (!key) return null;
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    const hash = stableHash(`npc-state-delta:birthday:v1:${key}`);
    if (!normalized.calendarValid) {
        const offset = hash % 365;
        let remaining = offset;
        for (let month = 1; month <= 12; month += 1) {
            const days = legacyMonthDays(month, 2001);
            if (remaining < days) return { era: '', year: null, month: String(month).padStart(2, '0'), day: remaining + 1 };
            remaining -= days;
        }
        return { era: '', year: null, month: '12', day: 31 };
    }

    let remaining = hash % calendarYearLength(normalized.config);
    for (const month of normalized.config.months) {
        if (remaining < month.days) return { era: '', year: null, month: month.name, day: remaining + 1 };
        remaining -= month.days;
    }
    const last = normalized.config.months.at(-1);
    return last ? { era: '', year: null, month: last.name, day: last.days } : null;
}
