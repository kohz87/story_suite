// The away part's dates: the story clock a line is read at, a date as the tail and screens write it, and what a `back:` label means.

import { durationMinutes } from '../../time/tracker/time.js';

const DAY = 1440;

/** The story clock of a command (`ctx.time()`), or null while it is not set. */
export function nowOf(ctx) {
    try {
        const minutes = typeof ctx?.time === 'function' ? ctx.time() : null;
        return Number.isSafeInteger(minutes) ? minutes : null;
    } catch {
        return null;
    }
}

/** The date of a story minute: "Goldwane 18" (no year, no clock). '' for null. */
export function dateText(calendar, minutes) {
    if (!Number.isSafeInteger(minutes)) return '';
    try {
        return calendar.format(minutes, { time: false, era: false });
    } catch {
        return '';
    }
}

/**
 * What a `back:` label means: a date on the chat's calendar ("Goldwane 18", "June 3, 1200") or a stretch of time from now
 * ("in 6 days", "+2d"), as the start of that day. `{ back }`, or `{ error }` in plain words. `now`: the story clock, or null.
 */
export function readBack(calendar, text, now) {
    const words = String(text ?? '').trim();
    if (!words) return { error: 'back: needs a date.' };
    const shown = words.length > 60 ? `${words.slice(0, 59)}…` : words;
    const stretch = durationMinutes(words.replace(/^in\s+/i, ''));
    if (stretch !== null) {
        if (!Number.isSafeInteger(now)) return { error: `"${shown}" counts from the story time, which is not set yet.` };
        return { back: Math.floor((now + stretch) / DAY) * DAY };
    }
    let parsed = null;
    try {
        parsed = calendar.parse(words, { reference: Number.isSafeInteger(now) ? now : null });
    } catch {
        parsed = null;
    }
    const abs = parsed && Number.isFinite(parsed.abs) ? Math.round(parsed.abs) : NaN;
    return Number.isSafeInteger(abs) ? { back: Math.floor(abs / DAY) * DAY } : { error: `"${shown}" is not a date on this calendar.` };
}
