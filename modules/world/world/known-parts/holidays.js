// Story Director v2, world: the pack calendar's holidays within a number of story days.

import { tryQuery } from './query.js';
import { isInt, text, cut } from './shared-text.js';

// The month a holiday names: its name on the calendar (any case), or its number (1 = the first).
function monthIndex(calendar, month) {
    const months = calendar.config?.months ?? [];
    if (isInt(month) && month >= 1 && month <= months.length) return month - 1;
    const key = text(month).toLowerCase();
    if (/^\d+$/.test(key)) return monthIndex(calendar, Number(key));
    return months.findIndex(entry => text(entry?.name).toLowerCase() === key);
}

/**
 * The pack calendar's holidays within `days` story days from `now`: `[{ name, at, inDays }]`, soonest first.
 * Read from `packs.calendar().holidays` (`[{ name, month, day }]`), only while the chat runs on that pack's
 * calendar (its months are the chat calendar's). Without a pack, or a pack without holidays: none.
 */
export function holidays(query, calendar, now, days) {
    if (!isInt(now)) return [];
    const pack = tryQuery(query, 'packs.calendar', {}, null);
    const list = Array.isArray(pack?.holidays) ? pack.holidays.slice(0, 60) : [];
    if (!list.length) return [];
    const ours = (calendar.config?.months ?? []).map(month => text(month?.name).toLowerCase()).join('|');
    const theirs = (Array.isArray(pack?.months) ? pack.months : []).map(month => text(month?.name).toLowerCase()).join('|');
    if (!ours || ours !== theirs) return [];
    const today = calendar.dayIndex(now);
    const { year } = calendar.fromAbs(now);
    const out = [];
    for (const entry of list) {
        const name = cut(entry?.name, 80);
        const month = monthIndex(calendar, entry?.month);
        const day = Number(entry?.day);
        if (!name || month < 0 || !isInt(day) || day < 1) continue;
        for (const y of [year, year + 1]) {
            if (day > calendar.daysInMonth(y, month)) continue;
            const at = calendar.toAbs({ year: y, month, day });
            const inDays = calendar.dayIndex(at) - today;
            if (inDays >= 0 && inDays <= days) {
                out.push({ name, at, inDays });
                break;
            }
        }
    }
    return out.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
}
