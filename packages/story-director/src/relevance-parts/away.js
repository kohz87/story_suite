// Summarizes records that came due or arrived during a time jump.

import { dateOf, isNumber } from './shared-dates.js';
import { isArriving, isDue } from './status.js';

const DAY_MINUTES = 1440;

// (0.9.19) How far the story time must move forward between two replies (a night's sleep,
// days on the road) for the note to tell what came due in between as one recap, "While away",
// instead of a pile of Due now items the scene never lived through. Twelve hours: an evening
// meal or an afternoon's ride is a scene going on; a night or more is time skipped.
export const AWAY_GAP_MINUTES = 12 * 60;

/**
 * What came due while the story skipped ahead: the records of `selection.due` and `.arriving`
 * whose date fell inside (`from`, `to`], when the story time moved forward by at least
 * `minMinutes` from `from` (the time before the latest reply) to `to` (the selection's now).
 * A record already due or arriving at `from` is not in it: it was waiting before the jump and
 * stays on Due now. Plain `{ from, to, due, arriving }`, or null with no such jump. Secrets are
 * never due, so they never come up here.
 */
export function awayIn(selection, { calendar, from = null, to = selection?.now ?? null, minMinutes = AWAY_GAP_MINUTES } = {}) {
    if (!calendar || !isNumber(from) || !isNumber(to)) return null;
    const gap = Number(minMinutes) >= 0 ? Number(minMinutes) : AWAY_GAP_MINUTES;
    if (to - from < gap || to <= from) return null;
    const before = { calendar, now: from };
    const due = (selection?.due ?? []).filter(record => record?.kind !== 'secret' && !isDue(record, before) && deadlinePassed(record, { calendar, to }));
    const arriving = (selection?.arriving ?? []).filter(record => record?.kind !== 'secret' && !isArriving(record, before));
    return { from, to, due, arriving };
}

// A quest's due is a deadline that runs to the end of its day (as the note writes it, 0.9.12):
// one due later today has not passed yet, so it stays on Due now as reached. Anything else, or
// a quest with no readable deadline, passes.
function deadlinePassed(record, { calendar, to }) {
    if (record?.kind !== 'quest') return true;
    const parsed = dateOf(record, 'due', { calendar, reference: to });
    if (!parsed) return true;
    const end = parsed.hasTime ? parsed.abs : calendar.addDays(calendar.dayIndex(parsed.abs) * DAY_MINUTES, 1) - 1;
    return end <= to;
}
