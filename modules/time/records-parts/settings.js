// The time part's settings: their defaults, reading them from a ctx, and the reader's calendar.

import { PRESETS, makeCalendar, normalizeCalendar } from '../calendar.js';
import { isInt } from './shared-int.js';

/** The part's settings defaults (section 'Time'). */
export const DEFAULTS = Object.freeze({
    // A jump of the story clock at least this long between two replies gets the While away recap.
    recapHours: 6,
    // Deadlines that pass close their threads (beats slip, offers lapse, quests fail).
    lapses: true,
});

/** The part's settings from a ctx's or view's `settings` (a function, an object, or nothing). */
export function timeSettings(source) {
    let value = source;
    if (typeof source === 'function') {
        try {
            value = source();
        } catch {
            value = null;
        }
    }
    const own = value && typeof value === 'object' ? value : {};
    const hours = Number(own.recapHours);
    return {
        recapHours: isInt(hours) && hours >= 1 ? hours : DEFAULTS.recapHours,
        lapses: typeof own.lapses === 'boolean' ? own.lapses : DEFAULTS.lapses,
        // The reader's calendar is the tracker part's setting; module.js hands it over as
        // `calendar` (or this part sees the module's values with the tracker's under `tracker`).
        calendar: own.calendar ?? own.tracker?.calendar ?? null,
    };
}

/** The reader's calendar (v1 calendar.js), Gregorian when the settings carry none. */
export function calendarOf(settings) {
    return makeCalendar(normalizeCalendar(settings?.calendar ?? PRESETS.gregorian));
}
