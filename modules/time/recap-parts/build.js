// Building the While away recap for a jump of the story clock.

import { AWAY_CUE, noteParts } from '../../../note.js';
import { AWAY_GAP_MINUTES, awayIn, classify, estimateTokens } from '../../../relevance.js';
import { trackerOf } from '../records.js';
import { v2Asks } from './asks.js';

export const RECAP_TAG = '[While away]';
// About 200 tokens: the recap gives up items from its end to stay within it.
export const RECAP_BUDGET = 200;

const span = (calendar, from, to) => `${calendar.format(from, { era: false })} → ${calendar.format(to, { era: false })}`;

// v1's While away part for `due` and `arriving`, with the span from `from`: v1 measures its own
// twelve-hour jump, so a shorter one is handed over from twelve hours back (the records are
// already chosen, and none of them was due then either) and its span written back to `from`.
function awayText({ calendar, from, to, due, arriving, more = 0 }) {
    const back = Math.min(from, to - AWAY_GAP_MINUTES);
    const selection = { now: to, place: '', arc: null, due, arriving, relevant: [], dormant: [], secrets: [], resolvedRecently: [] };
    const part = noteParts(selection, { calendar, previousTime: back, instruction: 'v2' }).find(entry => entry.label === 'While away');
    if (!part) return '';
    const head = `While away (${span(calendar, back, to)}): `;
    if (!part.text.startsWith(head)) return '';
    let body = part.text.slice(head.length);
    if (more > 0) body = body.replace(` ${AWAY_CUE}`, ` And ${more} more. ${AWAY_CUE}`);
    return `${RECAP_TAG} ${span(calendar, from, to)}: ${v2Asks(body)}`;
}

/**
 * The While away recap for a jump of the story clock from `from` to `to` on `director` (its
 * active threads): `{ lines, threads }` (the thread ids it tells; `fights: false`: no "fought
 * off-screen", as no module runs fights), or null when the jump is
 * shorter than `minMinutes` or nothing came due or arrived in it (v1 awayIn).
 */
export function buildRecap(director, { calendar, from, to, minMinutes, budget = RECAP_BUDGET, fights = true }) {
    if (!calendar || !Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return null;
    const { tracker, threadOf } = trackerOf(director, { calendar, now: to, fights });
    const selection = classify(tracker, { calendar, now: to, message: tracker.message });
    const away = awayIn(selection, { calendar, from, to, minMinutes });
    if (!away) return null;
    const arriving = away.arriving.filter(record => !away.due.includes(record));
    let due = away.due;
    let arrivals = arriving;
    const total = due.length + arrivals.length;
    let line = awayText({ calendar, from, to, due, arriving: arrivals });
    // Over the budget: the last items go first (arrivals, then what came due), counted as more.
    while (line && estimateTokens(line) > budget && due.length + arrivals.length > 1) {
        if (arrivals.length) arrivals = arrivals.slice(0, -1);
        else due = due.slice(0, -1);
        line = awayText({ calendar, from, to, due, arriving: arrivals, more: total - due.length - arrivals.length });
    }
    if (!line) return null;
    const threads = [...due, ...arrivals].map(record => threadOf.get(record)?.id).filter(Boolean);
    return { lines: [line], threads };
}
