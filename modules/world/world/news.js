// Story Director v2, world: when the news of a chronicle entry reaches a place (feature `story-director.world-events`; derived, nothing stored).
//
// `world.newsAt { entryId, place }` → `{ arrivesAt, via, km?, days? }`: the entry began at `since` (its story minute), and its news
// takes the delay news-delay.js works out between its place and `place`. `world.heardHere { place, now }` → the entries whose news
// has reached `place` by `now` (each with `arrivesAt` and `via`), newest news first. Both default `place` to the scene's and `now`
// to the Director's clock, and are null with the switch off. Rumours (the World pulse's) travel ahead of news and are never held
// back; an entry with no place or no start time is heard at once.

import { nowFrom } from './known-parts/clock.js';
import { queryOf, tryQuery } from './known-parts/query.js';
import { isInt, isRecord, text } from './known-parts/shared-text.js';
import { DAY, newsDelay } from './news-delay.js';
import { courierSpeed, worldEventsOn } from './news-switch.js';

const sceneName = (state, tools) => text(tryQuery(queryOf(tools), 'scene.place', {}, null)?.name) || text(state?.domains?.scene?.place?.name);

// The arrival of one event (`chronicle.events` copy) at `place`; `arrivesAt` is null when it is heard at once.
function arrival(tools, event, place) {
    if (typeof event.rumour === 'string' || !isInt(event.since)) return { arrivesAt: isInt(event.since) ? event.since : null, via: 'tier' };
    const delay = newsDelay(tools, text(event.place), place, courierSpeed(tools));
    if (!delay) return { arrivesAt: event.since, via: 'tier' };
    const { days, via, km } = delay;
    return { arrivesAt: event.since + Math.ceil(days * DAY), via, ...(km ? { km } : {}), days };
}

/** The entries whose news has reached `place` by `now`: `[{ ...event, arrivesAt, via, km?, days? }]`, or null with the switch off. */
export function heardHere(state, { place = null, now = null } = {}, tools) {
    if (!worldEventsOn(tools)) return null;
    const here = text(place) || sceneName(state, tools);
    const clock = isInt(now) ? now : nowFrom(queryOf(tools), state);
    const events = tryQuery(queryOf(tools), 'chronicle.events', {}, []);
    return (Array.isArray(events) ? events : []).filter(isRecord).map(event => ({ ...event, ...arrival(tools, event, here) }))
        .filter(event => !isInt(clock) || !isInt(event.arrivesAt) || event.arrivesAt <= clock);
}

/** `{ arrivesAt, via, km?, days? }` for the entry `entryId` at `place`, or null: the switch is off or there is no such entry. */
export function newsAt(state, { entryId = null, place = null } = {}, tools) {
    if (!worldEventsOn(tools)) return null;
    const event = tryQuery(queryOf(tools), 'chronicle.event', { id: entryId }, null);
    if (!isRecord(event)) return null;
    const out = arrival(tools, event, text(place) || sceneName(state, tools));
    return { arrivesAt: out.arrivesAt, via: out.via, ...(out.km ? { km: out.km } : {}), ...(typeof out.days === 'number' ? { days: out.days } : {}) };
}
