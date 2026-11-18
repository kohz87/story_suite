// The story day a lead (a hook that is a job offered) lapses on, by the rule that closes it (lapses.js lapseTime).

import { lapseTime } from '../../../time/lapses.js';
import { recordOf } from '../../../time/records.js';

/** `{ lapsesAt: minute | null, lapses: date text | '' }`; a plain hook, or no clock, never lapses. While the clock began at the calendar's default start (`fromDefault`) no year is known, so the date is told without it. */
export function lapseOf(thread, { calendar, now, fromDefault = false }) {
    let at = null;
    let lapses = '';
    try {
        at = lapseTime(recordOf(thread, { calendar }), { calendar, now });
        if (at !== null) lapses = calendar.format(at, { time: false });
        if (fromDefault) lapses = lapses.replace(/,\s*\d+\b.*$/, '');
    } catch {
        at = null;
        lapses = '';
    }
    return { lapsesAt: at, lapses };
}
