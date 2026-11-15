// Story Director v2, chronicle part: updates world event records, remembers old names, and formats world event summaries.

import { MAX_AKA, forgetSeen, isOpen, keyOf } from '../../domain.js';
import { sentence } from '../text.js';

const sameList = (a, b) => a.length === b.length && a.every((name, i) => name === b[i]);

// Keeps the old name findable after a rename (newest last, at most MAX_AKA).
export function rememberName(entry, oldName) {
    const aka = (entry.aka ?? []).filter(name => keyOf(name) !== keyOf(oldName) && keyOf(name) !== keyOf(entry.name));
    entry.aka = [...aka, oldName].slice(-MAX_AKA);
}

/**
 * Applies `fields` (`summary`, `state`, `place`, `factions`, and for a lasting entry `by`: the writing
 * event or null to unlock, `keep`) to an event (on the draft): what changed, as words. `updated` and
 * `rev` move only when something did.
 */
export function changeEvent(chronicle, event, fields, { now, rev }) {
    const changes = [];
    if (fields.summary !== undefined && fields.summary !== event.summary) {
        event.summary = fields.summary;
        changes.push('summary');
    }
    if (fields.state !== undefined && fields.state !== event.state) {
        event.state = fields.state;
        changes.push(fields.state);
        if (!isOpen(event)) forgetSeen(chronicle, event.id);
    }
    if (fields.place !== undefined && fields.place !== event.place) {
        event.place = fields.place;
        changes.push(fields.place ? `at ${fields.place}` : 'no place');
    }
    if (fields.factions !== undefined && !sameList(fields.factions, event.factions)) {
        event.factions = fields.factions;
        changes.push(fields.factions.length ? `with ${fields.factions.join(', ')}` : 'no factions');
    }
    if (fields.by !== undefined && (fields.by ?? undefined) !== event.by) {
        if (fields.by === null) delete event.by;
        else event.by = fields.by;
        changes.push(fields.by === null ? 'no longer locked' : 'set by the world\'s timeline');
    }
    if (fields.keep !== undefined && fields.keep !== (event.keep === true)) {
        if (fields.keep) event.keep = true;
        else delete event.keep;
        changes.push(fields.keep ? 'kept in mind' : 'no longer kept in mind');
    }
    if (changes.length) {
        if (now !== null) event.updated = now;
        event.rev = rev;
    }
    return changes;
}

export function eventSummary(event, created) {
    const where = event.place ? ` (${event.place})` : '';
    const about = event.summary ? ` — ${event.summary}` : '';
    if (event.state === 'resolved') return `World: ${event.name}${where} has ended${about}.`;
    return `World: ${event.name}${where} is ${created ? 'now ' : ''}${event.state}${about}.`;
}

/** An event as the Journal's world line tells it (the same words as the receipt of a `world` line). */
export const worldLineText = event => sentence(eventSummary(event, false));
