// Story Director v2, world: when the news of a chronicle entry reaches a place (feature `story-director.world-events`; derived, nothing
// stored; spec §4).
//
// `world.newsAt { entryId, place }` → `{ arrivesAt, via, km?, days?, endsAt? }` and `world.heardHere { place, now }` → the entries heard at
// `place` by `now`, newest news first, each with `arrivesAt`, `via`, `tag` ('fact' | 'rumour'), `news` ('fired' | 'ended') and the place
// as news names it. Both default `place` to the scene's and `now` to the Director's clock, and are null with the switch off.
// * A world happening (the daily step's, `by: event:world.…`) travels from where it happened by courier (news-delay.js) and is heard
//   as fact when the courier comes; it stops at its `reach`; its end is news of its own, from the day it ended, at the same speed.
//   A pack's legacy event (`event:pack.…`) travels the same way, with no reach.
// * A happening the story reported in a world line (not locked by an event) is heard at once: fact at its own place, rumour elsewhere until the courier time
//   (spec §4: "fact follows at courier time"). The World pulse's rumours are rumours. An entry with no place or start time is heard at once.

import { nowFrom } from './known-parts/clock.js';
import { queryOf, tryQuery } from './known-parts/query.js';
import { isInt, isRecord, text } from './known-parts/shared-text.js';
import { DAY, newsDelay } from './news-delay.js';
import { courierSpeed, worldEventsOn } from './news-switch.js';
import { placeInfo, shownPlace, withinReach } from './news-reach.js';
import { routeFactors } from './news-routes.js';
import { buildGeo } from '../daily/geo.js';
import { readWorld } from '../chronicle/world-daily/read-world.js';
import { WORLD_BY } from '../chronicle/world-daily/news-entries.js';
import { slotValue } from '../../rpg/slot.js';

const sceneName = (state, tools) => text(tryQuery(queryOf(tools), 'scene.place', {}, null)?.name) || text(state?.domains?.scene?.place?.name);

// What every arrival needs, worked out once per question.
function envOf(state, tools, now) {
    const query = queryOf(tools);
    const world = readWorld(query);
    const geo = buildGeo(world);
    const chronicle = state?.domains?.chronicle ?? {};
    const declared = tryQuery(query, 'chronicle.conditionNames', {}, []);
    const factorOf = routeFactors({ table: chronicle.conditions ?? {}, declared, geo, masks: slotValue(chronicle.daily)?.masks ?? {}, now });
    const env = { tools, geo, routes: world.routes, routeKinds: world.routeKinds, pace: courierSpeed(tools), factorOf, cache: new Map() };
    return env;
}

// The news of one entry at `place` by `clock`: null when it never comes (beyond its reach), else its arrival and how it is heard.
function arrival(env, event, place, clock) {
    const world = WORLD_BY.test(text(event.by));
    const origin = text(event.place) ? placeInfo(env.geo, env.tools, event.place) : null;
    if (world && !withinReach(event.reach, origin, place ? placeInfo(env.geo, env.tools, place) : null)) return null;
    const shown = { place: shownPlace(origin, env.tools, text(event.place)) };
    if (typeof event.rumour === 'string' || !isInt(event.since)) return { ...shown, arrivesAt: isInt(event.since) ? event.since : null, via: 'tier', tag: typeof event.rumour === 'string' ? 'rumour' : 'fact', news: 'fired' };
    const delay = newsDelay(env, text(event.place), place);
    if (!delay) return { ...shown, arrivesAt: event.since, via: 'tier', tag: 'fact', news: 'fired' };
    const { days, via, km } = delay;
    const after = Math.ceil(days * DAY);
    const out = { ...shown, arrivesAt: event.since + after, via, ...(km ? { km } : {}), days };
    const ended = world && event.state === 'resolved' && isInt(event.updated) && event.updated > event.since;
    if (ended) out.endsAt = event.updated + after;
    const come = !isInt(clock) || out.arrivesAt <= clock;
    // Only the story's own world lines are heard before their courier (as rumour); everything else waits for it.
    if (!come && (world || event.locked === true)) return { ...out, heard: false };
    out.tag = come ? 'fact' : 'rumour';
    out.news = ended && (!isInt(clock) || out.endsAt <= clock) ? 'ended' : 'fired';
    if (ended && out.news === 'fired') out.state = 'ongoing';
    return out;
}

/** The entries whose news has reached `place` by `now`: `[{ ...event, arrivesAt, via, tag, news, km?, days?, endsAt? }]`, or null with the switch off. */
export function heardHere(state, { place = null, now = null } = {}, tools) {
    if (!worldEventsOn(tools)) return null;
    const here = text(place) || sceneName(state, tools);
    const clock = isInt(now) ? now : nowFrom(queryOf(tools), state);
    const events = tryQuery(queryOf(tools), 'chronicle.events', {}, []);
    const env = envOf(state, tools, clock);
    return (Array.isArray(events) ? events : []).filter(isRecord)
        .map(event => ({ event, news: arrival(env, event, here, clock) }))
        .filter(({ news }) => news && news.heard !== false && (!isInt(clock) || !isInt(news.arrivesAt) || news.arrivesAt <= clock || news.tag === 'rumour'))
        .map(({ event, news }) => ({ ...event, ...news }));
}

/** `{ arrivesAt, via, km?, days?, endsAt? }` for the entry `entryId` at `place`, or null: the switch is off, no such entry, or beyond its reach. */
export function newsAt(state, { entryId = null, place = null } = {}, tools) {
    if (!worldEventsOn(tools)) return null;
    const event = tryQuery(queryOf(tools), 'chronicle.event', { id: entryId }, null);
    if (!isRecord(event)) return null;
    const out = arrival(envOf(state, tools, null), event, text(place) || sceneName(state, tools), null);
    if (!out) return null;
    return { arrivesAt: out.arrivesAt, via: out.via, ...(out.km ? { km: out.km } : {}), ...(typeof out.days === 'number' ? { days: out.days } : {}), ...(isInt(out.endsAt) ? { endsAt: out.endsAt } : {}) };
}

/**
 * `world.cueToday { now?, place? }` → `{ text, name }`: the newest world happening that fired today where the scene is (its place or
 * city, else its region), for the world note's "Today" line (the narrator may stage it: it happens here); null when there is none
 * or the switch is off.
 */
export function cueToday(state, { now = null, place = null } = {}, tools) {
    if (!worldEventsOn(tools)) return null;
    const here = text(place) || sceneName(state, tools);
    const clock = isInt(now) ? now : nowFrom(queryOf(tools), state);
    if (!here || !isInt(clock)) return null;
    const env = envOf(state, tools, clock);
    const scene = placeInfo(env.geo, tools, here);
    const today = Math.floor(clock / DAY);
    const events = tryQuery(queryOf(tools), 'chronicle.events', {}, []);
    // Only a happening with a place the map knows can be "here" (one with none is no cue anywhere).
    const found = (Array.isArray(events) ? events : []).filter(event => isRecord(event) && WORLD_BY.test(text(event.by)) && isInt(event.since) && Math.floor(event.since / DAY) === today)
        .filter(event => text(event.place) && scene && withinReach('regional', placeInfo(env.geo, tools, event.place), scene) && placeInfo(env.geo, tools, event.place))
        .sort((a, b) => b.since - a.since || (a.id < b.id ? -1 : 1))[0];
    return found ? { text: text(found.summary) || text(found.name), name: text(found.name) } : null;
}
