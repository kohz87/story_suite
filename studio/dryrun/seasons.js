// The seasons a dry run gives the step: the game's calendar seasons with each month as a name. A season written with month numbers (1 is the first
// month) or names reads the same as in a chat; the step only matches names, so numbers would leave the run on the built-in quarters.

import { calendarConfig } from '../../modules/time/tracker/time.js';

/** `seasonsOf(calendar)` → `[{ name, months: [month names] }]` for the calendar's seasons, or null when it has none. */
export function seasonsOf(calendar) {
    const list = Array.isArray(calendar?.seasons) ? calendar.seasons : [];
    if (!list.length) return null;
    const months = calendarConfig(null, calendar).months.map(month => month.name);
    return list.map(season => ({
        ...season,
        months: (Array.isArray(season?.months) ? season.months : []).map(month => (Number.isSafeInteger(month) ? (months[month - 1] ?? month) : month)),
    }));
}
