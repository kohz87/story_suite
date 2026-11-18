// Story Director v2, world: the news and factions {{user}} knows, newest first.

import { lineKey } from '../../changes.js';
import { dateText } from './clock.js';
import { agoText } from './day-words.js';
import { hiddenNames } from './hidden.js';
import { SUMMARY_POINTS } from './shared-limits.js';
import { heardStamps } from './heard.js';
import { memberFinder, placeIdOf, placeIds } from './links.js';
import { queryOf, tryQuery } from './query.js';
import { worldEventsOn } from '../news-switch.js';
import { WORLD_BY } from '../../chronicle/world-daily/news-entries.js';
import { threadsOf, planned } from './shared-threads.js';
import { isRecord, isInt, text, cut } from './shared-text.js';

const DAY = 1440;

// When and how a world happening's news came to the scene's place: `{ where, when, from }` (from: a courier, travellers, or rumour).
function arrivalStamp(news, here, calendar) {
    const at = news.news === 'ended' && isInt(news.endsAt) ? news.endsAt : news.arrivesAt;
    if (!isInt(at)) return null;
    const from = news.tag === 'rumour' ? 'rumour' : news.via === 'route' ? 'a courier' : 'travellers';
    return { where: here ? `in ${cut(here, 80)}` : '', when: calendar ? dateText(calendar, at, { time: false }) : '', from };
}

/**
 * The known news, newest first: the chronicle's events and the Director's event threads, each
 * `{ id, kind: 'world' | 'event', name, summary, state, open, when, ago, place, factions, placeId, factionIds, heard }`.
 * `placeId` and `factionIds` link to the atlas and the chronicle (null / []); `heard`: the stamps `{ where, when, from }` the
 * chat's receipts give (heard.js; [] for an event thread or when there are no receipts).
 */
export function knownNews(state, tools, { hidden = hiddenNames(state), calendar = null, now = null, ids = placeIds(tools) } = {}) {
    const query = queryOf(tools);
    const out = [];
    // Read lazily, once, when the first event needs it.
    let stamps = null;
    const stampsOf = id => (stamps ??= heardStamps(tools, calendar)).get(id) ?? [];
    const events = tryQuery(query, 'chronicle.events', {}, null);
    // With the world-events switch on, only the entries whose news has reached the scene's place (world.heardHere, news.js); a world
    // happening's card shows the place and state as heard here and, last, when its news came (seam audit E36).
    const heardList = worldEventsOn(tools) ? tryQuery(query, 'world.heardHere', {}, null) : null;
    const reached = Array.isArray(heardList) ? new Map(heardList.map(item => [item?.id, item])) : null;
    const here = reached ? text(tryQuery(query, 'scene.place', {}, null)?.name) : '';
    for (const raw of Array.isArray(events) ? events : []) {
        if (reached && !reached.has(raw?.id)) continue;
        // With the switch off nothing travels: a world happening the daily step wrote is news only once the story's own world line named it (a heard stamp).
        if (!reached && WORLD_BY.test(text(raw?.by)) && !stampsOf(text(raw?.id)).length) continue;
        const news = reached && typeof raw?.by === 'string' ? reached.get(raw.id) : null;
        const event = news ? { ...raw, place: news.place, state: news.state ?? raw.state } : raw;
        // A pulse rumour is unknown to {{user}} until the story's own world line named it (`heard`).
        if (!isRecord(event) || hidden.words.has(lineKey(text(event.name))) || (event.rumour !== undefined && event.heard !== true)) continue;
        out.push({
            id: text(event.id), kind: 'world', name: cut(event.name, 80), summary: cut(event.summary, SUMMARY_POINTS),
            state: text(event.state), open: event.open === true, when: text(event.updatedText), ago: text(event.updatedAgo),
            place: cut(event.place, 80), factions: cut(event.factionsText, 160),
            placeId: placeIdOf(ids, event.place), factionIds: (Array.isArray(event.factions) ? event.factions : []).map(entry => text(entry?.id)).filter(Boolean),
            heard: news ? [...stampsOf(text(event.id)), arrivalStamp(news, here, calendar)].filter(Boolean) : stampsOf(text(event.id)),
            at: isInt(event.updated) ? event.updated : null, rev: isInt(event.rev) ? event.rev : 0,
        });
    }
    for (const thread of threadsOf(state)) {
        if (thread.kind !== 'event' || planned(thread)) continue;
        const at = isInt(thread.track?.changed?.time) ? thread.track.changed.time : isInt(thread.track?.created?.time) ? thread.track.created.time : null;
        const open = thread.status === 'active' && !thread.ended;
        out.push({
            id: thread.id, kind: 'event', name: cut(thread.key, 80), summary: cut(thread.summary, SUMMARY_POINTS),
            // A dated happening has no looming/ongoing of its own: only "resolved" once the story closed it.
            state: open ? '' : 'resolved', open, when: calendar ? dateText(calendar, at) : '',
            ago: isInt(now) && isInt(at) && now >= at ? agoText(Math.floor(now / DAY) - Math.floor(at / DAY)) : '',
            place: '', factions: '', placeId: null, factionIds: [], heard: [],
            at, rev: isInt(thread.rev) ? thread.rev : 0,
        });
    }
    return out.sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity) || b.rev - a.rev || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(({ at, rev, ...item }) => item);
}

/**
 * The known factions, newest first (by the receipt that last changed them): `{ id, name, summary, area, stance, areaPlaceIds, members }`.
 * `areaPlaceIds`: the atlas place its area names (else []); `members`: known people whose dossier names the faction.
 */
export function knownFactions(state, tools, { hidden = hiddenNames(state), news = null, ids = placeIds(tools) } = {}) {
    const query = queryOf(tools);
    const members = memberFinder(tools);
    const factions = tryQuery(query, 'chronicle.factions', {}, null);
    // "Seen in: <event>" (made by the chronicle) names an event; it shows only while that event is in News.
    const seen = new Set((news ?? knownNews(state, tools, { hidden })).filter(item => item.kind === 'world').map(item => lineKey(text(item.name))));
    const summaryOf = faction => {
        const named = /^Seen in: (.+?)\.?$/.exec(text(faction.summary));
        return named && !seen.has(lineKey(named[1])) ? '' : cut(faction.summary, SUMMARY_POINTS);
    };
    return (Array.isArray(factions) ? factions : [])
        .filter(faction => isRecord(faction) && !hidden.words.has(lineKey(text(faction.name))))
        .sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(faction => {
            const placeId = placeIdOf(ids, faction.area);
            return {
                id: text(faction.id), name: cut(faction.name, 80), summary: summaryOf(faction), area: cut(faction.area, 80), stance: cut(faction.stance, 80),
                areaPlaceIds: placeId ? [placeId] : [], members: members(faction),
            };
        });
}
