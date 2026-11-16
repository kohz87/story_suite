// Story Director v2, chronicle part: creates and expires world pulse rumour events.

import {
    MAX_EVENTS, RUMOUR_DAYS, RUMOUR_OPEN_MAX, cleanName, cleanSummary, findIn, isOpen, isRecord, keyOf, newId, prune, revOf,
} from '../../domain.js';
import { clockOf } from '../text.js';

// Closes the pulse's rumours that are over: older than RUMOUR_DAYS story days, or about an event that has ended or is gone. Returns how many.
function closeRumours(ctx, chronicle, now, rev, extra = 0) {
    const open = Object.values(chronicle.events).filter(event => event.rumour !== undefined && isOpen(event));
    const over = event => now - event.since >= RUMOUR_DAYS * 1440 || !isOpen(findIn(chronicle.events, event.rumour) ?? { state: 'resolved' });
    const shut = open.filter(over);
    // At creation (`extra` 1) the oldest also go when the open ones would pass RUMOUR_OPEN_MAX.
    const rest = open.filter(event => !shut.includes(event)).sort((a, b) => (a.since - b.since) || (a.id < b.id ? -1 : 1));
    shut.push(...rest.slice(0, Math.max(0, rest.length + extra - RUMOUR_OPEN_MAX)));
    // An older reply's event may be gone when this step replays after a delete: the write is marked ctx.ifThere (SPEC §2.2).
    for (const event of shut) {
        if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', `/events/${event.id}`);
        Object.assign(event, { state: 'resolved', updated: now, rev });
    }
    return shut.length;
}

/**
 * `chronicle.rumor { at, event: { name, summary?, place?, factions?, rumour? } }` (cause `system`, a step of the World pulse): talk of something goes
 * round, written as a `looming` world event (`rumour`: the name of the event it is about). Refused from a click. A name the chronicle
 * already has is left as it is. `{ at, expire: true }` only closes the rumours that are over (RUMOUR_DAYS story days old, or their event ended).
 * At most RUMOUR_OPEN_MAX are open: the oldest close first. Fails (NOT_YET) while the clock is not set, and (REFUSED) when MAX_EVENTS are all under way.
 */
export function rumor(ctx, payload = {}) {
    if (ctx.cause === 'ui') return ctx.fail('REFUSED', 'Rumours are started by Story Director itself, before a reply.');
    const given = isRecord(payload?.event) ? payload.event : null;
    const name = cleanName(typeof given?.name === 'string' ? given.name : '');
    const expire = payload?.expire === true && !given;
    if (!expire && (!given || !keyOf(name))) return ctx.fail('INVALID', 'chronicle.rumor takes { at, event: { name, summary?, place?, factions?, rumour? } } or { at, expire: true }.');
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; a rumour waits for one.');
    const chronicle = ctx.draft('chronicle');
    const rev = revOf(ctx);
    if (expire) return { summary: '', narrate: false, data: { event: null, closed: closeRumours(ctx, chronicle, now, rev) } };
    if (findIn(chronicle.events, name)) return { summary: '', narrate: false, data: { event: null } };
    const events = Object.values(chronicle.events);
    if (events.length >= MAX_EVENTS && events.every(isOpen)) return ctx.fail('REFUSED', `The chronicle already follows ${MAX_EVENTS} world events under way.`);
    closeRumours(ctx, chronicle, now, rev, 1);
    const id = newId(ctx, 'ev', chronicle.events);
    const factions = (Array.isArray(given.factions) ? given.factions : []).map(item => cleanName(String(item ?? ''))).filter(item => keyOf(item)).slice(0, 4);
    const about = cleanName(typeof given.rumour === 'string' ? given.rumour : '');
    chronicle.events[id] = { id, name, summary: cleanSummary(typeof given.summary === 'string' ? given.summary : ''), state: 'looming', since: now, updated: now, place: cleanName(typeof given.place === 'string' ? given.place : ''), factions, aka: [], rev, rumour: about || name };
    prune(chronicle);
    return { summary: '', narrate: false, data: { event: id } };
}
