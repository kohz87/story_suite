// Writing the last event of a reply: the whole new text for one paced event (nextEvent) and a scan's evidence added as the reasons of story events (withEvidence).
import { AXES, EVENT_MAX, EVENT_TEXT_MAX, LOG_MAX } from './shared-limits.js';
import { DATE_MAX, NOTE_MAX, WHY_MAX, wholeInt } from './shared-fields.js';
import { readEvent, validEvent } from './event-read.js';
import { cutWords } from './event-text.js';
import { snapshotOf } from './event-log.js';

/** What a hosted run records for one paced event: the whole new text for the record (`prior`: the stored text), or null when it need not change. */
export function nextEvent(prior, { reply, date, src, ask, tier, held, note, via, gate, why, mv, n = null, log = true }) {
    const old = readEvent(prior);
    const same = Boolean(old) && old.at === reply;
    // `log` false: a Re-read of a reply the older code wrote (no log) writes it as it was. The same reply's later events follow the text they join.
    const logged = log !== false && (!same || Array.isArray(old.prev));
    let events = same ? old.events : [];
    const mine = Object.fromEntries(AXES.filter(axis => wholeInt(ask?.[axis]) && ask[axis] !== 0).map(axis => [axis, ask[axis]]));
    const item = { src, ask: mine, tier, held: Boolean(held), note: String(note || '').slice(0, NOTE_MAX), ...(String(why || '').trim() ? { why: String(why).trim().slice(0, WHY_MAX) } : {}), ...(via ? { via, ...(gate ? { gate } : {}) } : {}), ...(logged && mv && Object.keys(mv).length ? { mv } : {}) };
    // A full list (EVENT_MAX) makes room by dropping the oldest event of the new one's own kind (held or spent), else the oldest, so
    // a later spent event is never hidden behind four held ones (the card would say "Nothing moved") nor the reverse. An event that
    // fired the gate is dropped last: the next prompt's gate cue reads it.
    if (events.length >= EVENT_MAX) {
        const at = [e => e.held === item.held && !e.gate, e => !e.gate, e => e.held === item.held, () => true]
            .map(test => events.findIndex(test)).find(index => index !== -1);
        events = events.filter((_, index) => index !== at);
    }
    const head = { at: reply, date: String(date || '').slice(0, DATE_MAX), events: [...events, item] };
    let prev = logged ? (same ? old.prev : [...(old ? [snapshotOf(old)] : []), ...(old?.prev ?? [])].slice(0, LOG_MAX)) : null;
    // A text that is too long loses the oldest log row first, never the new event.
    const write = () => JSON.stringify(prev ? { ...head, ...(wholeInt(n) && n >= 0 ? { n } : {}), prev } : head);
    while (prev?.length && write().length > EVENT_TEXT_MAX) prev = prev.slice(0, -1);
    const text = write();
    return validEvent(item) && text.length <= EVENT_TEXT_MAX ? text : null;
}

/**
 * A one-pass scan's evidence as the reason of this reply's story events that gave none (`evidence`: { axis: words }): each such event's why is
 * the evidence of the axes its line asked, in axis order, joined by "; " (cut at a word to WHY_MAX). → the whole new text, or null when nothing gains a reason.
 */
export function withEvidence(prior, reply, evidence) {
    const old = readEvent(prior);
    if (!old || old.at !== reply || !evidence || typeof evidence !== 'object') return null;
    const words = item => AXES.filter(axis => Object.hasOwn(item.ask, axis) && typeof evidence[axis] === 'string').map(axis => evidence[axis].trim().replace(/[\s.;]+$/, '')).filter(Boolean).join('; ');
    let changed = false;
    const events = old.events.map(item => (item.src !== 'story' || item.why || !words(item) ? item : (changed = true, { ...item, why: cutWords(words(item)) })));
    const text = changed ? JSON.stringify({ ...old, events }) : null;
    return text && text.length <= EVENT_TEXT_MAX ? text : null;
}
