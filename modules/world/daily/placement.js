// World events, the daily step: where a recurring event or a minor template happens (spec v0.10 §3 where / Explicit kinds /
// Placeholders, §5 placement). Generic placement weighs places by class (capital/city > town > village > outpost = site; none
// never); a `where` naming kinds picks among matching places whatever their class, equal weight unless the place has `weight`.
// A place under a placeStatus condition gets no templates. Ties break by place id; all weights 0 → equal. Pure.

import { CLASS_WEIGHT, resolveRef } from './geo.js';
import { conditionHolds } from './holds-read.js';

const DAY = 1440;
const low = text => String(text ?? '').trim().toLowerCase();

/** The binding of a picked place: `{ place, region, realm }` (names), for @place, @region and @realm. */
export const bindOf = place => ({ place: place.name, region: place.region || null, realm: place.realm });

/** Whether a placeStatus condition (fallen, evacuated, abandoned) holds on the place today: on it, or on the place it sits under (B12). */
export function masked(ws, place, day) {
    for (const entry of ws.declared.values()) if (entry.placeStatus === true && conditionHolds(ws, entry.name, place.name, day * DAY)) return true;
    return false;
}

/**
 * The places `where` allows, each `{ place, weight }`, in place id order. `where`: { fit } (anywhere generic), { kinds } (explicit),
 * { refs } (places, or every generic place in the named regions/realms), or null (anywhere generic). `template`: skip masked places.
 */
export function placesFor(ws, where, day, { template = false } = {}) {
    let list;
    if (where?.kinds?.length) {
        const kinds = new Set(where.kinds.map(low));
        list = ws.geo.places.filter(place => kinds.has(low(place.kind)) || kinds.has(place.klass)).map(place => ({ place, weight: place.weight ?? 1 }));
    } else {
        const generic = ws.geo.places.filter(place => place.klass !== 'none').map(place => ({ place, weight: place.weight ?? CLASS_WEIGHT[place.klass] ?? 1 }));
        if (where?.refs?.length) {
            const named = where.refs.map(ref => resolveRef(ws.geo, ref)).filter(Boolean);
            list = generic.filter(({ place }) => named.some(found => (found.kind === 'place' ? found.name === place.name : found.kind === 'region' ? low(found.name) === low(place.region) : found.kind === 'realm' && found.name === place.realm)));
            for (const found of named) if (found.kind === 'place' && found.place.klass === 'none') list.push({ place: found.place, weight: found.place.weight ?? 1 });
        } else list = generic;
    }
    if (template) list = list.filter(({ place }) => !masked(ws, place, day));
    return list.sort((a, b) => (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0));
}

/** A weighted pick with one draw in [0, 1): cumulative over the list in order; all weights 0 → equal. Null for an empty list. */
export function weightedPick(list, draw) {
    if (!list.length) return null;
    const total = list.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    const weights = total > 0 ? list.map(item => Math.max(0, item.weight)) : list.map(() => 1);
    const sum = total > 0 ? total : list.length;
    let at = draw * sum;
    for (let index = 0; index < list.length; index += 1) {
        if (at < weights[index]) return list[index].place;
        at -= weights[index];
    }
    return list[list.length - 1].place;
}
