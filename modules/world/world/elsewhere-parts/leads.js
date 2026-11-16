// The World screen's Leads data: the hooks the player has heard of, newest first.

import { lineKey } from '../../../changes.js';
import { agoText, calendarFrom, cut, hiddenNames, namesHidden, nowFrom, queryOf } from '../known.js';
import { lapseOf } from './lapse-date.js';
import { isRecord } from './shared-guards.js';

const SUMMARY_CHARS = 160;
const DAY = 1440;

const isInt = value => Number.isSafeInteger(value);
const dayOf = minutes => Math.floor(minutes / DAY);

/** How many story days ago `minutes` was, as text ("today", "yesterday", "3 days ago"), or '' when unknown or in the future. */
const ageOf = (now, minutes) => (isInt(now) && isInt(minutes) && now >= minutes ? agoText(dayOf(now) - dayOf(minutes)) : '');

/** The hooks the player has heard of, newest first (`heard` is the hook's summary; see the header for the filter). */
export function leadsOf(state, tools) {
    const query = queryOf(tools);
    const now = nowFrom(query, state);
    const hidden = hiddenNames(state);
    const calendar = calendarFrom(query);
    const threads = isRecord(state?.domains?.director?.threads) ? Object.values(state.domains.director.threads).filter(isRecord) : [];
    const out = [];
    for (const thread of threads) {
        if (thread.kind !== 'hook' || thread.status !== 'active' || thread.ended || thread.offer || thread.track?.arc) continue;
        const name = cut(thread.key, 80);
        const heard = cut(thread.summary, SUMMARY_CHARS);
        if (!name || hidden.behind.has(lineKey(name)) || namesHidden(heard, hidden.words)) continue;
        const at = isInt(thread.track?.created?.time) ? thread.track.created.time : null;
        out.push({
            id: cut(thread.id, 80),
            name,
            heard,
            heardAgo: ageOf(now, at),
            where: cut(thread.fields?.where ?? thread.fields?.place, 80),
            ...lapseOf(thread, { calendar, now }),
            at,
        });
    }
    return out
        .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(({ at, ...item }) => item);
}
