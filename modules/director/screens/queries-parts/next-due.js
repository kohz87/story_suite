// Story Director v2, part screens: the open thread whose date comes first (`director.next`).

import { BEHIND } from '../reveal.js';
import { calendarFrom } from './calendar.js';
import { hidingBehind } from './behind-view.js';
import { queryFrom } from './shared-ask.js';
import { isOpen, threadsOf } from './shared-threads.js';
import { text } from './shared-words.js';

// Fields that hold a date the story can reach (v1 relevance.js DATE_FIELDS).
const DATE_FIELDS = ['due', 'on', 'arrive'];

// A date without a clock time counts for its whole day (v1 relevance.js reachedBy).
function reached(parsed, now, calendar) {
    if (!Number.isInteger(now)) return false;
    if (!parsed.hasTime) return calendar.dayIndex(parsed.abs) <= calendar.dayIndex(now);
    return parsed.abs <= now;
}

/**
 * `director.next` → the open thread whose date (`due`, `on` or `arrive`, read on the reader's calendar
 * from the story time) comes first: `{ id, key, kind, summary, field, when, at, reached }`, or null.
 * `reached` is true once that date has come (it is due now or overdue). Secrets are never due.
 */
export function nextDue(state, args, tools, { settings = null } = {}) {
    const query = queryFrom(tools);
    // `shown: true` (the card under each reply): while behind the scenes is hidden, only what the reader
    // may see (quests, hooks, world events) is named there.
    const hide = args?.shown === true && hidingBehind(tools);
    const threads = threadsOf(state, query, { status: 'active' }).filter(thread => isOpen(thread) && thread.kind !== 'secret' && !(hide && BEHIND.has(thread.kind)));
    if (!threads.length) return null;
    const calendar = calendarFrom(settings, query);
    const minutes = state?.domains?.director?.time?.minutes;
    const now = Number.isInteger(minutes) ? minutes : null;
    let best = null;
    for (const thread of threads) {
        for (const field of DATE_FIELDS) {
            const when = text(thread.fields?.[field]);
            if (!when) continue;
            let parsed = null;
            try {
                parsed = calendar.parse(when, { reference: now });
            } catch {
                parsed = null;
            }
            if (!parsed || !Number.isFinite(parsed.abs)) continue;
            const at = Math.round(parsed.abs);
            if (!best || at < best.at) best = { thread, field, when, at, parsed };
        }
    }
    if (!best) return null;
    const { thread, field, when, at, parsed } = best;
    return {
        id: thread.id,
        key: text(thread.key),
        kind: thread.kind,
        summary: text(thread.summary),
        field,
        when,
        at,
        reached: reached(parsed, now, calendar),
    };
}
