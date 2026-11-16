// Story Director v2, tracker part: applies a story-told time line (`~ time <date>`, `! time +2h`) to the story clock.

import { addProblem, replyDraft } from '../domain.js';
import { calendarOf, lineStretch, maxJumpMinutes, packCalendarOf, sameStretch, settingsFrom, splitTimeLine, timeAfter } from '../time.js';
import { clockFaceAfter, dayKey } from '../time-parts/clock-face.js';
import { DAY_MINUTES } from '../time-parts/limits.js';
import { KEY_CHARS } from './limits.js';
import { beginTurn } from './reply.js';
import { lineText } from './text.js';

/** `apply(ctx, line)` for `time` lines: `~ time <date, clock time>`, `! time +2h`. */
export function applyTimeLine(ctx, line) {
    // "~ time <date> · ! time +2h" on one line is the two lines (the same stretch counts once: timeLine). One command writes one clock op, so
    // its receipt says that op: `from` the clock before the command (the first part that read one), `kind` 'set' if any part set it.
    // A joined line writes one op through plain sets only (a set and an anchored set on one path are a conflict in Story Block).
    const pieces = splitTimeLine(line);
    const parts = pieces.map((part, n) => timeLine(ctx, part, n > 0, pieces.length === 1));
    const last = parts.at(-1);
    if (parts.length < 2) return last;
    const from = parts.map(part => part.data.from).find(Number.isSafeInteger);
    const kind = parts.some(part => part.data.kind === 'set') ? 'set' : 'move';
    return { ...last, data: { ...last.data, kind, ...(Number.isSafeInteger(from) ? { from } : {}) } };
}

// `again`: the second half of a joined line, which is the same line (the same place in the reply), not a new reply.
function timeLine(ctx, line, again = false, anchorable = true) {
    const director = ctx.draft('director');
    // `from`: the clock when this reply's first Director line was read. maxJump holds for the whole
    // reply, so a reply that repeats "! time +30d" moves the clock 30 days in all (C2-5).
    const turn = (again && replyDraft(director)) || beginTurn(director, ctx, line);
    const { from } = turn;
    const settings = settingsFrom(typeof ctx.settings === 'function' ? ctx.settings() : ctx.settings);
    const calendar = calendarOf(settings, packCalendarOf(ctx.query));
    // A reply marked `clockFace` (Story Block's rule marks) reads its time lines by the clock-face rules: a clock face is today's time, nothing moves back.
    const faced = Array.isArray(ctx.carrier?.rules) && ctx.carrier.rules.includes('clockFace');
    const read = faced ? clockFaceAfter : timeAfter;
    // `openDay`: the day a jump landed on (stored, so a replay reads the same); the next time line on it may set any clock time there.
    const options = { maxJump: maxJumpMinutes(settings), from, ...(faced ? { openDay: director.time.openDay ?? null } : {}) };
    const stretch = lineStretch(line);
    // The same stretch of time counts once: a date and a "+X" within 15 minutes of the gap from where
    // the reply began, in either order, are one stretch, and the date is the one that is used.
    if (stretch !== null && Number.isSafeInteger(turn.setAt) && Number.isSafeInteger(from) && sameStretch(stretch, turn.setAt - from)) {
        const kept = director.time.minutes;
        return { summary: `Story time: ${calendar.format(kept)}.`, narrate: false, data: { minutes: kept, from: kept, kind: 'move' } };
    }
    let next = null;
    if (stretch === null && turn.advanced > 0 && Number.isSafeInteger(from)) {
        const alone = read(line, from, calendar, options);
        if (alone.set && !alone.error && sameStretch(turn.advanced, alone.minutes - from)) next = alone;
    }
    const fromNow = next === null ? read(line, director.time.minutes, calendar, options) : null;
    next ??= fromNow;
    if (!next.error && Number.isSafeInteger(next.minutes)) {
        if (stretch !== null) turn.advanced = (turn.advanced ?? 0) + stretch;
        else if (next.set) turn.setAt = next.minutes;
    }
    if (next.problem) addProblem(director, ctx, { kind: 'time', severity: 'warn', key: String(line?.name ?? '').slice(0, KEY_CHARS), op: line?.op, text: next.problem });
    // An anchored set (`ctx.anchored`, Story Block rule h) follows a clock that an earlier edit or delete moved, as a fresh telling of the line would.
    // Only read from the clock as it stands (not the reply's start), and only where Story Block has it.
    const anchoring = anchorable && faced && typeof ctx.anchored === 'function' && Number.isSafeInteger(director.time.minutes);
    if (next.error) {
        addProblem(director, ctx, { kind: 'time', severity: 'warn', key: String(line?.name ?? '').slice(0, KEY_CHARS), op: line?.op, text: next.error });
        const now = director.time.minutes;
        // A refused `~` clock face keeps its mark: after an edit that moves the day it is today's face on the new day (the clock stays when it is not).
        if (anchoring && Number.isSafeInteger(next.face)) {
            ctx.anchored('director', '/time/minutes', { period: DAY_MINUTES, roll: 'same', to: next.face });
            return { summary: `Director: ${lineText(line)} (not used)`, narrate: false, data: { minutes: now, from: now, kind: 'same', to: next.face } };
        }
        return { summary: `Director: ${lineText(line)} (not used)`, narrate: false, data: { minutes: now, kind: 'move' } };
    }
    const before = director.time.minutes;
    if (next.minutes !== before) director.time.minutes = next.minutes;
    // A date sets the clock: stored as a set (Story Block's ctx.absolute, SPEC §2.2), so it stays exact
    // when an earlier reply that moved the clock is deleted, and later moves add on top. An older Story
    // Block without it stores the set as a move.
    if (faced) {
        const openDay = dayKey(next.minutes) !== dayKey(before) && Number.isSafeInteger(before) ? dayKey(next.minutes) : null;
        if (openDay !== (director.time.openDay ?? null)) director.time.openDay = openDay;
    }
    const roll = anchoring && next.set && !next.held && next === fromNow ? next.roll : undefined;
    const set = Boolean(next.set) && !roll && typeof ctx.absolute === 'function';
    if (roll) ctx.anchored('director', '/time/minutes', { period: DAY_MINUTES, roll });
    else if (set) ctx.absolute('director', '/time/minutes');
    // `kind`: the op the receipt describes, as Story Block replays it (a move: `from` → `minutes`; a set: the stored minute; 'same' / 'after': an anchored set).
    return {
        summary: `Story time: ${calendar.format(next.minutes)}.`,
        narrate: false,
        data: { minutes: next.minutes, from: before, kind: roll ?? (set ? 'set' : 'move'), ...(next.held ? { held: next.held } : {}) },
    };
}
