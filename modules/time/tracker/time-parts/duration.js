// Reading a written stretch of time (`+2h`, `an hour and 30 minutes`) as minutes.

import { DAY_MINUTES } from './limits.js';

const UNITS = [
    [/^(?:w|wk|wks|weeks?)$/i, 7 * DAY_MINUTES],
    [/^(?:d|days?)$/i, DAY_MINUTES],
    [/^(?:h|hr|hrs|hours?)$/i, 60],
    [/^(?:m|min|mins|minutes?)$/i, 1],
];
const AMOUNT = /(?:(?<![\d.])(\d+(?:\.\d+)?)|(?<![a-z])(half an?|an?)(?![a-z]))\s*([a-z]+)/gi;

/**
 * Minutes in a written stretch of time: `+2h`, `2 hours`, `+1d 4h`, `an hour and 30 minutes`.
 * A whole number of minutes, or null when the text is not only a stretch of time.
 */
export function durationMinutes(input) {
    const source = String(input ?? '').trim().replace(/^\+\s*/, '').replace(/\b(?:and|later|pass(?:es|ed)?)\b|,|\.(?!\d)/gi, ' ').trim();
    if (!source) return null;
    let total = 0;
    let rest = source;
    for (const match of source.matchAll(AMOUNT)) {
        const unit = UNITS.find(([pattern]) => pattern.test(match[3]));
        if (!unit) return null;
        const amount = match[1] !== undefined ? Number(match[1]) : /^half/i.test(match[2]) ? 0.5 : 1;
        total += amount * unit[1];
        rest = rest.replace(match[0], ' ');
    }
    if (rest.trim() || total <= 0) return null;
    return Math.round(total);
}

/** Minutes a `! time +2h` line passes, or null when the line is a date (or not usable). */
export function lineStretch(line) {
    if (line?.op === '-' || line?.op === '?') return null;
    return durationMinutes([line?.name, line?.text].map(part => String(part ?? '').trim()).filter(Boolean).join(' '));
}

/** Whether a stretch of `span` minutes and a gap of `gap` minutes are the same stretch of time (within 15 minutes). */
export const sameStretch = (span, gap) => Number.isFinite(span) && Number.isFinite(gap) && Math.abs(span - gap) <= SAME_STRETCH;
const SAME_STRETCH = 15;
