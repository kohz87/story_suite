// A time line read under the clockFace rule: a clock face sets today's time, a skip moves forward, nothing moves back.

import { DAY_MINUTES, MAX_JUMP_DAYS, MAX_YEAR } from './limits.js';
import { durationMinutes } from './duration.js';
import { badClock, held, timeAfter } from './timeline.js';

// `tomorrow`, `tomorrow evening`, `next day`, `next morning`, `next day at 8 am`: [, what time of that day].
const NEXT_DAY = /^(?:(?:tomorrow|next\s+day)(?:\s+(?:at\s+)?(.+))?|next\s+(.+))$/i;

/** The calendar day a time is on, as the string the director stores for a day-jump receipt (a string, so it is stored as a set, never added up). */
export const dayKey = minutes => (Number.isSafeInteger(minutes) ? String(Math.floor(minutes / DAY_MINUTES)) : null);

const wordsOf = line => [line?.name, line?.text].map(part => String(part ?? '').trim()).filter(Boolean).join(' ');
const clip = words => (words.length > 80 ? `${words.slice(0, 79)}…` : words);

/**
 * The time a skip (`! time tomorrow evening`, `! time next morning`) lands on: that time on the next calendar day
 * (a bare `tomorrow` or `next day` is that day's morning), or null when the words are not such a skip.
 */
export function skipTarget(words, minutes, calendar) {
    const match = NEXT_DAY.exec(words.trim());
    if (!match || !Number.isInteger(minutes)) return null;
    const rest = (match[1] ?? match[2] ?? 'morning').trim();
    const read = calendar.parse(rest, { reference: minutes + DAY_MINUTES });
    // Only a clock time or part of the day: a written date would be a date, not a skip.
    if (!read || !Number.isFinite(read.abs) || !read.hasTime || calendar.parse(rest, { reference: null }) !== null) return null;
    return Math.round(read.abs);
}

/**
 * What a `time` line does to the story time `minutes` when its reply carries the `clockFace` mark: `{ minutes, set, roll? }` (`roll`: 'same' | 'after' for a bare clock face, a skip, a bare `!` time), or
 * `{ error, face? }` in plain words (`face`: the minute a refused `~` clock face asked for). Durations, and any line while the clock is not set yet, are read as timeAfter reads them.
 * `~`/`+` with a clock face: today's time, never earlier than now. `!`: the next such time after now, or `tomorrow …` / `next morning`.
 * A date is accepted when it is not before now. `options.openDay`: the day a jump landed on, when no time line has read since; a `~` clock face on that day may go earlier than the landing face. A refused line leaves the clock where it was.
 */
export function clockFaceAfter(line, minutes, calendar, options = {}) {
    const words = wordsOf(line);
    const { maxJump = MAX_JUMP_DAYS * DAY_MINUTES, from = null, openDay = null } = options;
    if (line?.op === '-' || line?.op === '?' || !words || !Number.isInteger(minutes) || durationMinutes(words) !== null) return timeAfter(line, minutes, calendar, options);
    const shown = clip(words);
    const bad = badClock(words);
    if (bad) return { error: `"${shown}" has ${bad}, which is not a clock time; the story time is left as it was.` };
    const skip = line.op === '!' ? skipTarget(words, minutes, calendar) : null;
    const parsed = calendar.parse(words, { reference: minutes });
    if (skip === null && (!parsed || !Number.isFinite(parsed.abs))) return { error: `"${shown}" is not a date or a stretch of time on this calendar.` };
    if (skip === null && (!Number.isSafeInteger(parsed.year) || Math.abs(parsed.year) > MAX_YEAR)) return { error: `"${shown}" names a year past ${MAX_YEAR}; the story time is left as it was.` };
    let target = skip ?? Math.round(parsed.abs);
    const bare = skip === null && calendar.parse(words, { reference: null }) === null;
    if (bare && line.op === '!' && target <= minutes) target += DAY_MINUTES;
    // After a jump into a later day (the stored `openDay` receipt) the first `~` clock face on that day may set any time on it, earlier than the landing face too.
    const open = bare && line.op !== '!' && openDay === dayKey(minutes) && dayKey(target) === openDay;
    if (target < minutes && !open) {
        const now = calendar.format(minutes);
        // `face`: what the refused `~` face asked for, so the caller can keep it anchored (a replay that moves the day reads it again).
        if (bare) return { error: `"~ time ${shown}" is earlier than the story time (${now}); the clock never goes back. If a new day has begun, write "! time ${shown}".`, face: target };
        return { error: `"${shown}" names a date before the story time (${now}); the clock never goes back, so the line was not used.` };
    }
    // `roll`: how this set follows a clock that moved before it (Story Block's anchored set): a `~` clock face is today's time ('same'),
    // a skip or a bare `!` clock time is the next such time ('after'). A date, a held jump and an early face on the open day are plain sets.
    const result = { ...held(minutes, target, maxJump, shown, from), set: true };
    if (!result.held && !(open && target < minutes)) {
        if (skip !== null || (bare && line.op === '!')) result.roll = 'after';
        else if (bare) result.roll = 'same';
    }
    return result;
}
