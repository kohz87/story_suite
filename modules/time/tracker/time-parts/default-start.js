// The calendar's default start: where a time line with no date reads from while the story has not set the clock (no pack, or a pack with no start date).

import { durationMinutes } from './duration.js';

/** The default start's year and clock time: year 1, the first day of the first month, 08:00 (fixed, so it reads the same each time; a replay reads the same for an unchanged calendar setting). */
export const DEFAULT_YEAR = 1;
const DEFAULT_MINUTE = 8 * 60;

const wordsOf = line => [line?.name, line?.text].map(part => String(part ?? '').trim()).filter(Boolean).join(' ');

/** The calendar's default start in story minutes (null on a calendar that cannot give one). */
export function defaultStart(calendar) {
    const minutes = calendar.toAbs({ year: DEFAULT_YEAR, month: 0, day: 1, minutes: DEFAULT_MINUTE });
    return Number.isSafeInteger(minutes) ? minutes : null;
}

/**
 * The clock a time line is read from: `{ from, set, floating }`. The clock itself once the story has set it. While it is not set (no pack start), a line
 * with no date ("~ time 9:30 am", "! time +2h", "! time next morning") reads from the calendar's default start and sets the clock there
 * (`set`), so the story clock works with no pack; a line with a date sets it as it always did. While the clock still carries the stored marker
 * `time.fromDefault` (set by that first date-less line, cleared by the first date), a line with a date is read as the first one (`floating`: the
 * date sets the clock; a story's real date is not held to the longest jump from an arbitrary start). A pack that starts in year 1 has no marker,
 * so it keeps the jump guard.
 */
export function clockToRead(calendar, time, line) {
    const minutes = time?.minutes;
    const words = wordsOf(line);
    const dated = words !== '' && durationMinutes(words) === null && calendar.parse(words, { reference: null }) !== null;
    if (!Number.isSafeInteger(minutes)) {
        const start = dated || words === '' ? null : defaultStart(calendar);
        const usable = start !== null && dateless(calendar, words, start);
        return { from: usable ? start : null, set: usable, floating: false };
    }
    const floating = dated && time?.fromDefault === true;
    return { from: floating ? null : minutes, set: false, floating };
}

// Only a stretch ("+2h") or a clock time / part of day with with no other number written ("9:30 am", "next morning"): "2026-11-17 9:30 am" is a date the calendar cannot read, not a time.
function dateless(calendar, words, start) {
    if (durationMinutes(words) !== null) return true;
    const read = calendar.parse(words, { reference: start });
    return read !== null && !/\d/.test(words.replace(read.text, ''));
}
