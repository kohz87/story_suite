// The story day a lead (a hook that is a job offered) lapses on, by the rule that closes it (lapses.js lapseTime).

import { lapseTime } from '../../../time/lapses.js';
import { recordOf } from '../../../time/records.js';

/** `{ lapsesAt: minute | null, lapses: date text | '' }`; a plain hook, or no clock, never lapses. */
export function lapseOf(thread, { calendar, now }) {
    let at = null;
    let lapses = '';
    try {
        at = lapseTime(recordOf(thread, { calendar }), { calendar, now });
        if (at !== null) lapses = calendar.format(at, { time: false });
    } catch {
        at = null;
        lapses = '';
    }
    return { lapsesAt: at, lapses };
}
