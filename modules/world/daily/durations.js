// World events, the daily step: durations (spec v0.10 §2 Time units). "10 days", "2 weeks", "1 season", "1 year", "until cleared"
// → whole days; every scaled duration is multiplied by tempo (0.25-4) and rounded up to whole days, minimum 1; a season is 90 × tempo. Pure.

const UNIT = Object.freeze({ day: 1, week: 7, month: 30, season: 90, year: 360 });
const UNTIL_CLEARED = 'until cleared';

/** Tempo (0.25-4, default 1): anything else is refused by the caller; this only scales. */
export const scaleDays = (days, tempo = 1) => Math.max(1, Math.ceil(days * tempo - 1e-9));

/** The season length in whole days at `tempo` (90 × tempo, rounded up). */
export const seasonDays = (tempo = 1) => scaleDays(90, tempo);

/**
 * A duration text → its unscaled days (a number), `null` for "until cleared" (when `open`), or `undefined` when it is not one.
 * "0 days" is a duration of 0 here; the caller raises a condition timer to 1 day (§2: a timer is at least 1 day).
 */
export function durationDays(text, { open = false } = {}) {
    const raw = typeof text === 'string' ? text.trim().toLowerCase() : '';
    if (open && raw === UNTIL_CLEARED) return null;
    const match = /^(\d+(?:\.\d+)?|an?)\s+(day|week|month|season|year)s?$/.exec(raw);
    if (!match) return undefined;
    return (/^an?$/.test(match[1]) ? 1 : Number(match[1])) * UNIT[match[2]];
}

/** Scaled whole days of a duration text (min 1), `null` for until cleared, `undefined` when unreadable. */
export function scaledDays(text, tempo = 1, options = {}) {
    const days = durationDays(text, options);
    return days === null || days === undefined ? days : scaleDays(days, tempo);
}
