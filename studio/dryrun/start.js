// Where a Studio dry run starts: the world's start date as the story's first day on the run's calendar, as a chat's first step reads it
// (`today = floor(story minutes / day)`, world-daily/command.js), and the world's start state (`start.world`, kept in `content.start` by pack format 4).

import { calendarConfig } from '../../modules/time/tracker/time.js';
import { makeCalendar } from '../../modules/time/calendar.js';

const DAY = 1440;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => (Array.isArray(value) ? value : []);

/** The pack's start record: `content.start` (format 4), else the older top-level `start`. */
export const startOf = pack => (isObject(pack?.content?.start) ? pack.content.start : (isObject(pack?.start) ? pack.start : {}));

/** The world's start state as the step takes it, `{ set, facts }`, or null when the pack gives none. */
export function startWorldOf(pack) {
    const begin = startOf(pack).world;
    return isObject(begin) ? { set: list(begin.set), facts: list(begin.facts) } : null;
}

/**
 * `startDayOf(pack, calendar)` → `{ day, date }`: the absolute day of the world's start date on `calendar` (the game's calendar config, or none for Gregorian)
 * and the date `{ year, month (name), day }`; `{ day: 1, date: null }` when the pack has no readable start date there. A month is its 1-based number or its name.
 */
export function startDayOf(pack, calendar = null) {
    const none = { day: 1, date: null };
    const start = startOf(pack).date;
    if (!isObject(start)) return none;
    const cal = makeCalendar(calendarConfig(null, calendar));
    const months = cal.config.months;
    const byName = months.findIndex(entry => entry.name.toLowerCase() === String(start.month ?? '').trim().toLowerCase());
    const month = Number.isSafeInteger(start.month) ? start.month - 1 : byName;
    const { year, day } = start;
    if (![year, day].every(Number.isSafeInteger) || month < 0 || month >= months.length || day < 1 || day > cal.daysInMonth(year, month)) return none;
    const minutes = cal.toAbs({ year, month, day, minutes: 0 });
    if (!Number.isSafeInteger(minutes)) return none;
    return { day: Math.floor(minutes / DAY), date: { year, month: months[month].name, day } };
}
