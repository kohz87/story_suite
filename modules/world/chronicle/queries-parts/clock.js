// Chronicle queries' reading of the chat's calendar, the Director's clock and a date as text.

import { PRESETS, makeCalendar } from '../../../time/calendar.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { agoText } from '../days.js';
import { ask } from './shared-ask.js';

/** The chat's calendar (makeCalendar) through `director.calendar`, else Gregorian. */
export function calendarFrom(query) {
    const config = ask(query, 'director.calendar', {});
    try {
        return makeCalendar(config && typeof config === 'object' ? config : PRESETS.gregorian);
    } catch {
        return makeCalendar(PRESETS.gregorian);
    }
}

/** The Director's clock in story minutes (null while unset): `director.time`, else the state. */
export function nowFrom(query, state) {
    const asked = ask(query, 'director.time', {});
    if (isInt(asked?.minutes)) return asked.minutes;
    const minutes = state?.domains?.director?.time?.minutes;
    return isInt(minutes) ? minutes : null;
}

export { agoText };

export function dateText(calendar, minutes) {
    if (!isInt(minutes)) return '';
    try {
        return calendar.format(minutes);
    } catch {
        return '';
    }
}
