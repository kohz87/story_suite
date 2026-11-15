// Chronicle queries' plain copies of one event and one faction.

import { findIn, isLocked, isOpen, keyOf, orderedEvents } from '../domain.js';
import { agoText } from '../days.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { dateText } from './clock.js';

/** An event as the queries give it. */
export function eventOut(event, { chronicle, calendar, now }) {
    const factions = (event.factions ?? []).map(name => ({ name, id: findIn(chronicle?.factions, name)?.id ?? null }));
    return {
        id: event.id,
        name: event.name,
        summary: event.summary,
        state: event.state,
        open: isOpen(event),
        place: event.place,
        factions,
        factionsText: factions.map(entry => entry.name).join(', '),
        since: event.since,
        updated: event.updated,
        sinceText: dateText(calendar, event.since),
        updatedText: dateText(calendar, event.updated),
        updatedAgo: isInt(now) && isInt(event.updated) ? agoText(now - event.updated) : '',
        aka: [...(event.aka ?? [])],
        rev: event.rev,
        // Only what a pack event's lasting change set, so an older entry's answer is as it was.
        ...(isLocked(event) ? { locked: true } : {}),
        ...(event.keep === true ? { keep: true } : {}),
        // A rumour of the World pulse: its own marks (known.js leaves it off the World screen until the story's own line named it).
        ...(typeof event.rumour === 'string' ? { rumour: event.rumour, ...(event.heard === true ? { heard: true } : {}) } : {}),
    };
}

/** A faction as the queries give it, with the open events that name it. */
export function factionOut(faction, { chronicle }) {
    const names = [faction.name, ...(faction.aka ?? [])].map(keyOf);
    const events = orderedEvents(chronicle).filter(event => isOpen(event) && (event.factions ?? []).some(name => names.includes(keyOf(name))))
        .map(event => ({ id: event.id, name: event.name, state: event.state }));
    return {
        id: faction.id,
        name: faction.name,
        summary: faction.summary,
        area: faction.area,
        stance: faction.stance,
        events,
        eventsText: events.map(event => event.name).join(', '),
        aka: [...(faction.aka ?? [])],
        rev: faction.rev,
    };
}
