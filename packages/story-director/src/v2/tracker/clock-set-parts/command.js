// Story Director v2, tracker part: the `director.clock` command that sets the story clock by the reader's hand.

import { calendarOf, packCalendarOf, settingsFrom } from '../time.js';
import { clockProblem, heroDate, partsOf } from './date.js';
import { fail, isInt } from './shared-guards.js';

export const CLOCK = 'director.clock';

/**
 * `director.clock { year, month, day, minutes }` (cause `ui`): the story clock set to that date and time on the chat's
 * calendar, or a refusal (`INVALID`) naming the field. Works while the clock is unset too.
 */
export function clockCommand(ctx, payload) {
    if (ctx.cause !== 'ui') fail(ctx, 'REFUSED', 'Only you set the story clock by hand; the story sets it with a time line.');
    const settings = settingsFrom(ctx.settings);
    const calendar = calendarOf(settings, packCalendarOf(ctx.query));
    const problem = clockProblem(calendar, payload);
    if (problem) fail(ctx, 'INVALID', problem);
    const { year, month, day, minutes } = payload;
    const abs = calendar.toAbs({ year, month: month - 1, day, minutes });
    if (!isInt(abs)) fail(ctx, 'INVALID', 'Pick a date and a time.');

    const director = ctx.draft('director');
    const before = isInt(director.time?.minutes) ? director.time.minutes : null;
    director.time.minutes = abs;
    // A set, not a move (Story Block's ctx.absolute, SPEC §2.2): kept exact when an earlier reply that moved the clock is
    // deleted, and later moves add on top. An older Story Block without it stores the set as a move.
    if (typeof ctx.absolute === 'function') ctx.absolute('director', '/time/minutes');

    // The short form leaves out the year (and era) while the year did not change, as the Director's own note does.
    const sameYear = before !== null && partsOf(calendar, before)?.year === year;
    const full = heroDate(calendar, abs);
    const short = heroDate(calendar, abs, { year: false });
    return {
        summary: `Clock set to ${sameYear ? short : full}`,
        // The Director note gives the time every reply, and a jump forward is told as While away: nothing more to narrate.
        narrate: false,
        // `edit: true` is what Story Block's reply card lists under "Changed this reply" as the reader's own edit (reply-cards.js replyEdits).
        data: { minutes: abs, from: before, date: full, edit: true },
    };
}
