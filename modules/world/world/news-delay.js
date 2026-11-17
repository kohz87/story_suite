// Story Director v2, world: how long news takes to travel from one place to another (spec §4; pure, needs the queries it is given).
//
// Between two places of the packs' map: the courier over their routes (news-courier.js: speeds by route class, the world's conditions
// on each route). A place only the atlas knows (the story made it) goes by the atlas's courier (`atlas.courier`, at the reader's pace).
// Where no courier-usable route joins them, by reach steps: the same place no time, the same region 1 day, the same realm 4 days
// (the Wilds count as one), anywhere else 10. A place nobody knows is told apart by its name alone (the same name is the same place).

import { lineKey } from '../changes.js';
import { parseLocation } from '../../atlas/places.js';
import { queryOf, tryQuery } from './known-parts/query.js';
import { text } from './known-parts/shared-text.js';
import { courierDays } from './news-courier.js';
import { placeInfo } from './news-reach.js';

/** Days by reach step, when no route joins the places. */
export const TIER_DAYS = Object.freeze({ place: 0, region: 1, realm: 4, far: 10 });
export const DAY = 1440;

// "near Dragonfang", "Bluewatch — Guild Office": the town as the atlas would name it.
const townOf = name => parseLocation(text(name).replace(/^(?:near|around|outside|beyond|by|at|in|off)\s+/i, '')).name.trim();

/**
 * `{ days, via: 'route' | 'tier', km? }` for news from `from` to `to` (place names), or null when either is empty (undated: heard at
 * once). `env`: `{ tools, geo, routes, routeKinds, pace, factorOf }` (news.js builds it once per question).
 */
export function newsDelay(env, from, to) {
    const [a, b] = [text(from), text(to)];
    if (!a || !b) return null;
    const [ta, tb] = [townOf(a), townOf(b)];
    if (lineKey(a) === lineKey(b) || (ta && lineKey(ta) === lineKey(tb))) return { days: TIER_DAYS.place, via: 'tier' };
    const [pa, pb] = [placeInfo(env.geo, env.tools, a) ?? placeInfo(env.geo, env.tools, ta), placeInfo(env.geo, env.tools, b) ?? placeInfo(env.geo, env.tools, tb)];
    const mapped = name => env.geo.byName.has(String(name ?? '').trim().toLowerCase());
    let trip = null;
    if (pa && pb && mapped(pa.name) && mapped(pb.name)) trip = courierDays(env, pa.name, pb.name);
    else trip = tryQuery(queryOf(env.tools), 'atlas.courier', { from: ta || a, to: tb || b, kmPerDay: env.pace }, null);
    if (trip && typeof trip.days === 'number') return { days: trip.days, via: 'route', ...(trip.km > 0 ? { km: trip.km } : {}) };
    if (pa && pb && lineKey(pa.name) === lineKey(pb.name)) return { days: TIER_DAYS.place, via: 'tier' };
    const same = key => Boolean(pa && pb && text(pa[key]) && lineKey(text(pa[key])) === lineKey(text(pb[key])));
    if (same('region')) return { days: TIER_DAYS.region, via: 'tier' };
    if (same('realm')) return { days: TIER_DAYS.realm, via: 'tier' };
    return { days: TIER_DAYS.far, via: 'tier' };
}
