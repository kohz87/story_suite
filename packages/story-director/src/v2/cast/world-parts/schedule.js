// Determining when the cast is due to move and when people were placed.

import { dayAt, dayOf, isInt, slotOf } from '../domain.js';

/** A stretch of time that moves the cast even inside one day: six story hours. */
export const SKIP_MINUTES = 360;

/** What moves the cast now: `{ from, to, reset }` or null. `reset`: the clock went back (a rewind), so the cast only follows it. */
export function dueMove(slice, now) {
    const at = dayAt(slice);
    if (!isInt(now) || at === null) return null;
    if (now < at) return { from: at, to: now, reset: true };
    if (dayOf(now) > dayOf(at) || now - at >= SKIP_MINUTES) return { from: at, to: now, reset: false };
    return null;
}

/** The story minute a person with no `since` of their own has been placed since: the first the cast knew (`day.first`, new chats), else its current day (so far people stay far). */
export const placedOf = slice => (isInt(slotOf(slice?.day)?.first) ? slotOf(slice.day).first : dayAt(slice));
