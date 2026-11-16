// The time part's queries: `time.now`, `time.lastLine`, `time.overdue` and `time.recap`.

import { makeCalendar } from '../calendar.js';
import { calendarOf, timeSettings } from '../records.js';
import { slotValue } from '../../rpg/slot.js';
import { isInt } from './shared-int.js';

const copy = value => structuredClone(value);

const stillActive = (director, ids) => (Array.isArray(ids) ? ids : [])
    .map(id => director?.threads?.[id])
    .filter(thread => thread && thread.status === 'active')
    .map(thread => ({ id: thread.id, key: thread.key, kind: thread.kind, due: String(thread.fields?.due ?? thread.fields?.on ?? '') }));

// The chat's calendar for a query: the tracker's `director.calendar` (the reader's, else the enabled
// pack's, else Gregorian), else this part's own settings as module.js hands them over.
function queryCalendar(tools) {
    try {
        const config = typeof tools?.query === 'function' ? tools.query('director.calendar', {}) : null;
        if (config && typeof config === 'object') return makeCalendar(config);
    } catch {
        // No tracker part: this part's settings.
    }
    return calendarOf(timeSettings(tools?.settings));
}

/**
 * `time.now`: the story clock for other modules (for example, the day digest):
 * `{ minutes, text, day, date }`: whole story minutes, that time on the chat's calendar
 * ("June 3, 1200, 08:00 am"), the story day (minutes / 1440, floored) and its date ("June 3, 1200").
 * While the story has not set the time: `{ minutes: null, text: '', day: null, date: '' }`.
 */
export function nowQuery(state, _args, tools) {
    const minutes = state?.domains?.director?.time?.minutes;
    if (!isInt(minutes)) return { minutes: null, text: '', day: null, date: '' };
    let text = '';
    let date = '';
    try {
        const calendar = queryCalendar(tools);
        text = calendar.format(minutes);
        date = calendar.format(minutes, { time: false });
    } catch {
        text = '';
        date = '';
    }
    return { minutes, text, day: Math.floor(minutes / 1440), date };
}

/**
 * `time.lastLine`: the chat index of the last reply whose receipts moved the clock by a time line (`capture.time` or `director.advance`), `{ index }`;
 * `{ index: null }` when none is kept (trimmed receipts only make a gap read long).
 */
export function lastLineQuery(_state, _args, tools) {
    let entries = [];
    try { entries = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { entries = []; }
    let index = null;
    for (const entry of Array.isArray(entries) ? entries : []) {
        const type = entry?.receipt?.type;
        if ((type === 'capture.time' || type === 'director.advance') && Number.isSafeInteger(entry.index) && (index === null || entry.index > index)) index = entry.index;
    }
    return { index };
}

export const queries = {
    'time.lastLine': lastLineQuery,
    'time.now': nowQuery,
    /**
     * Where threads stood when the story time was last settled: `{ minutes, lapsed, overdue,
     * pay, due }`, each a list of `{ id, key, kind, due }` (lapsed: closed in that jump, with
     * `reason`; the others still open), or null before the first settle.
     */
    'time.overdue': state => {
        const director = state?.domains?.director;
        const checked = slotValue(director?.checked);
        if (!checked) return null;
        const lapsed = (checked.lapsed ?? []).map(id => director.threads?.[id]).filter(Boolean)
            .map(thread => ({ id: thread.id, key: thread.key, kind: thread.kind, due: String(thread.fields?.due ?? thread.fields?.on ?? ''), reason: thread.ended?.reason ?? '' }));
        return {
            minutes: checked.minutes,
            lapsed,
            overdue: stillActive(director, checked.overdue),
            pay: stillActive(director, checked.pay),
            due: stillActive(director, checked.due),
        };
    },
    /** The While away recap kept for the reply after a jump: `{ fromMinutes, toMinutes, lines, threads, rev, at }` or null. */
    'time.recap': state => {
        const recap = slotValue(state?.domains?.director?.recap);
        return recap ? copy(recap) : null;
    },
};
