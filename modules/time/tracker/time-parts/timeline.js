// What a `time` line does to the story clock: splitting joined forms and setting or moving the time.

import { DAY_MINUTES, MAX_JUMP_DAYS, MAX_YEAR } from './limits.js';
import { durationMinutes } from './duration.js';

// "~ time <date> · ! time +2h" on one line (the narrator copies the grammar's joined forms): [date line, advance line].
const JOINED = /^(.*?)\s+[·|]\s+([!+~])\s*time\s+(\S.*)$/is;
const unbracket = text => text.trim().replace(/^<\s*([\s\S]*?)\s*>$/, '$1').trim();

/** A `time` line written as two joined forms is read as the two lines; any other line comes back as it is. */
export function splitTimeLine(line) {
    const words = [line?.name, line?.text].map(part => String(part ?? '').trim()).filter(Boolean).join(' ');
    const joined = JOINED.exec(words);
    if (!joined || !unbracket(joined[1]) || !unbracket(joined[3])) return [line];
    return [{ ...line, name: unbracket(joined[1]), text: '' }, { ...line, op: joined[2], name: unbracket(joined[3]), text: '' }];
}

/**
 * What a `time` line does to the story time `minutes` (null: not set yet): `{ minutes }`, or
 * `{ error }` in plain words. A date alone runs from its day's start, as v1 reads the scene's
 * time; a bare clock time or part of the day that is earlier than now is the next day's.
 * `from` is the clock when the reply began (default `minutes`): the reply's lines together move it at
 * most `maxJump` past that, however many they are (C2-5).
 */
export function timeAfter(line, minutes, calendar, { maxJump = MAX_JUMP_DAYS * DAY_MINUTES, from = null } = {}) {
    const words = [line?.name, line?.text].map(part => String(part ?? '').trim()).filter(Boolean).join(' ');
    if (line?.op === '-' || line?.op === '?') return { error: 'Story time only moves forward or is set: write "! time +2h" or "~ time <date, clock time>".' };
    if (!words) return { error: 'A time line needs a date or a stretch of time.' };
    const shown = words.length > 80 ? `${words.slice(0, 79)}…` : words;
    const known = Number.isInteger(minutes);
    const stretch = durationMinutes(words);
    if (stretch !== null) {
        if (!known) return { error: `The story time is not set yet, so "${shown}" cannot move it on; write "~ time <date, clock time>" first.` };
        return held(minutes, minutes + stretch, maxJump, shown, from);
    }
    const bad = badClock(words);
    if (bad) return { error: `"${shown}" has ${bad}, which is not a clock time; the story time is left as it was.` };
    const parsed = calendar.parse(words, { reference: known ? minutes : null });
    if (!parsed || !Number.isFinite(parsed.abs)) return { error: `"${shown}" is not a date or a stretch of time on this calendar.` };
    if (!Number.isSafeInteger(parsed.year) || Math.abs(parsed.year) > MAX_YEAR) return { error: `"${shown}" names a year past ${MAX_YEAR}; the story time is left as it was.` };
    let abs = Math.round(parsed.abs);
    // No date written (only "evening", "08:00 am"): the reference's day, or the next one.
    const bare = calendar.parse(words, { reference: null }) === null;
    if (known && bare && abs < minutes) abs += DAY_MINUTES;
    // `set`: a date sets the clock (stored as a set, not a move: applyTimeLine).
    return { ...(known ? held(minutes, abs, maxJump, shown, from) : { minutes: abs }), set: true };
}

// A move past `maxJump` minutes from the reply's start (`from`, else `minutes`) is held there:
// `{ minutes, held: { asked } }`. The clock never goes back for it (another rule moved it further).
export function held(minutes, next, maxJump, shown, from) {
    const start = Number.isSafeInteger(from) ? from : minutes;
    const limit = Math.max(minutes, start + maxJump);
    if (!(next > limit)) return { minutes: next };
    const days = Math.round(maxJump / DAY_MINUTES);
    const span = `${days} day${days === 1 ? '' : 's'}`;
    return {
        minutes: limit,
        held: { asked: Number.isSafeInteger(next) ? next - minutes : null },
        problem: start === minutes
            ? `"${shown}" moves the story time more than ${span} at once; it moved ${span} (the longest jump is the Calendar setting "Longest time jump").`
            : `"${shown}" would take the story time more than ${span} past where this reply began; it stops there (the longest jump in one reply is the Calendar setting "Longest time jump").`,
    };
}

// A written clock time no clock shows ("25:99 pm", "13 pm", "0 am"), in words, or ''. The calendar's
// reader skips such a time and reads the date alone, at its day's start.
const CLOCKISH = /(?<![\p{L}\d:.])(\d{1,3})(?::(\d{1,3}))?(?:\s*([ap])\.?\s?m\.?)?(?![\p{L}\d])/giu;
export function badClock(words) {
    for (const match of words.matchAll(CLOCKISH)) {
        const [, hourText, minuteText, half] = match;
        if (minuteText === undefined && !half) continue;
        const hour = Number(hourText);
        const minute = minuteText === undefined ? 0 : Number(minuteText);
        const ok = minuteText === undefined || minuteText.length === 2;
        if (!ok || minute > 59 || (half ? hour < 1 || hour > 12 : hour > 23)) return `"${match[0].trim()}"`;
    }
    return '';
}
