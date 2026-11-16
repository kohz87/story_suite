// The log rows of a reply's events: one reply as a row (snapshotOf) and the recent change rows (eventLog).
import { AXES, LOG_MAX } from './shared-limits.js';
import { wholeInt } from './shared-fields.js';
import { cutWords } from './event-text.js';

const sumAxes = (events, key) => Object.fromEntries(AXES.map(axis => [axis, events.reduce((sum, item) => sum + (item[key]?.[axis] ?? 0), 0)]).filter(([, value]) => value !== 0));

/** One current-format reply's events as one log row (the oldest events' reasons first, joined by "; "). */
export function snapshotOf(event) {
    const events = event.events;
    const mv = sumAxes(events, 'mv');
    const ask = Object.keys(mv).length || events.some(item => item.mv) ? {} : sumAxes(events, 'ask');
    const why = cutWords([...new Set(events.map(item => item.why).filter(Boolean))].join('; '));
    const held = events.every(item => item.held);
    const note = held ? events.find(item => item.note)?.note : '';
    const n = wholeInt(event.n) ? event.n : (wholeInt(event.at) ? event.at : null);
    return { at: event.at, ...(n !== null ? { n } : {}), date: event.date, ...(Object.keys(mv).length ? { mv } : Object.keys(ask).length ? { ask } : {}), held, ...(note ? { note } : {}), ...(why ? { why } : {}) };
}

/** The recent change rows of a read event, newest first: the current reply's, then the earlier ones the log kept (up to three). A text from before the log has only its own. */
export function eventLog(event) {
    return event ? [snapshotOf(event), ...(event.prev ?? [])].slice(0, LOG_MAX + 1) : [];
}
