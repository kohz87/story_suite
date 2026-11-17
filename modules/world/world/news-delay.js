// Story Director v2, world: how long news takes to travel from one place to another (pure; needs the atlas's queries).
//
// By the courier over the route graph when the atlas has a chain of routes between the two places (`atlas.courier`, the pace
// the reader's setting gives); where there is none, by tier: the same place no time, the same region 1 day, the same realm 4
// days, anywhere else 10. A place the atlas does not know is told apart by its name alone (the same name is the same place).

import { lineKey } from '../changes.js';
import { parseLocation } from '../../atlas/places.js';
import { queryOf, tryQuery } from './known-parts/query.js';
import { text } from './known-parts/shared-text.js';

/** Days by tier, when no route joins the places. */
export const TIER_DAYS = Object.freeze({ place: 0, region: 1, realm: 4, far: 10 });
export const DAY = 1440;

// "near Dragonfang", "Bluewatch — Guild Office": the town as the atlas would name it.
const townOf = name => parseLocation(text(name).replace(/^(?:near|around|outside|beyond|by|at|in|off)\s+/i, '')).name.trim();

/**
 * `{ days, via: 'route' | 'tier', km? }` for news from `from` to `to` (place names), or null when either is empty (undated: heard at once).
 * `route` carries `km` when the routes give it. `kmPerDay` is the courier's pace.
 */
export function newsDelay(tools, from, to, kmPerDay) {
    const [a, b] = [townOf(from), townOf(to)];
    if (!a || !b) return null;
    if (lineKey(a) === lineKey(b)) return { days: TIER_DAYS.place, via: 'tier' };
    const query = queryOf(tools);
    const trip = tryQuery(query, 'atlas.courier', { from: a, to: b, kmPerDay }, null);
    if (trip && typeof trip.days === 'number') return { days: trip.days, via: 'route', ...(trip.km > 0 ? { km: trip.km } : {}) };
    const [pa, pb] = [tryQuery(query, 'atlas.place', { name: a }, null), tryQuery(query, 'atlas.place', { name: b }, null)];
    if (pa && pb && pa.id === pb.id) return { days: TIER_DAYS.place, via: 'tier' };
    const same = key => Boolean(pa && pb && text(pa[key]) && lineKey(text(pa[key])) === lineKey(text(pb[key])));
    if (same('region')) return { days: TIER_DAYS.region, via: 'tier' };
    if (same('realm')) return { days: TIER_DAYS.realm, via: 'tier' };
    return { days: TIER_DAYS.far, via: 'tier' };
}
