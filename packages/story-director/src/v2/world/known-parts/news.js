// Story Director v2, world: the news and factions {{user}} knows, newest first.

import { lineKey } from '../../../changes.js';
import { dateText } from './clock.js';
import { agoText } from './day-words.js';
import { hiddenNames } from './hidden.js';
import { SUMMARY_POINTS } from './shared-limits.js';
import { queryOf, tryQuery } from './query.js';
import { threadsOf, planned } from './shared-threads.js';
import { isRecord, isInt, text, cut } from './shared-text.js';

const DAY = 1440;

/**
 * The known news, newest first: the chronicle's events and the Director's event threads, each
 * `{ id, kind: 'world' | 'event', name, summary, state, open, when, ago, place, factions }`.
 */
export function knownNews(state, tools, { hidden = hiddenNames(state), calendar = null, now = null } = {}) {
    const query = queryOf(tools);
    const out = [];
    const events = tryQuery(query, 'chronicle.events', {}, null);
    for (const event of Array.isArray(events) ? events : []) {
        // A pulse rumour is unknown to {{user}} until the story's own world line named it (`heard`).
        if (!isRecord(event) || hidden.words.has(lineKey(text(event.name))) || (event.rumour !== undefined && event.heard !== true)) continue;
        out.push({
            id: text(event.id), kind: 'world', name: cut(event.name, 80), summary: cut(event.summary, SUMMARY_POINTS),
            state: text(event.state), open: event.open === true, when: text(event.updatedText), ago: text(event.updatedAgo),
            place: cut(event.place, 80), factions: cut(event.factionsText, 160),
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
            place: '', factions: '', at, rev: isInt(thread.rev) ? thread.rev : 0,
        });
    }
    return out.sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity) || b.rev - a.rev || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(({ at, rev, ...item }) => item);
}

/** The known factions, newest first (by the receipt that last changed them): `{ id, name, summary, area, stance }`. */
export function knownFactions(state, tools, { hidden = hiddenNames(state), news = null } = {}) {
    const query = queryOf(tools);
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
        .map(faction => ({ id: text(faction.id), name: cut(faction.name, 80), summary: summaryOf(faction), area: cut(faction.area, 80), stance: cut(faction.stance, 80) }));
}
