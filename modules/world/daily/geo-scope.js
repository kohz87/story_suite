// World events, the daily step: scope on the map (spec v0.10 §2 Scope hierarchy, §3 Caps): the refs that contain a ref, narrow →
// broad, and the realms (or the Wilds) an event's `where` takes slots in. Pure.

import { WILDS, resolveRef } from './geo.js';

const low = text => String(text ?? '').trim().toLowerCase();

/** The refs that contain `ref`, narrow → broad: a place, its region, its realm; a region and its realm; a realm; a route alone. */
export function ancestors(geo, ref) {
    const found = resolveRef(geo, ref);
    if (!found) return [];
    if (found.kind === 'place') return [found.name, found.place.region, found.place.realm].filter(Boolean);
    if (found.kind === 'region') return [found.name, geo.regionRealm.get(low(found.name)) ?? WILDS];
    return [found.name];
}

/** The realm (or the Wilds) of each entry of a `where` list; a route counts by its endpoints. Sorted, unique. */
export function realmsOf(geo, where) {
    const out = new Set();
    for (const entry of Array.isArray(where) ? where : [where]) {
        const found = resolveRef(geo, entry);
        if (!found) continue;
        if (found.kind === 'place') out.add(found.place.realm);
        else if (found.kind === 'region') out.add(geo.regionRealm.get(low(found.name)) ?? WILDS);
        else if (found.kind === 'realm') out.add(found.name);
        else {
            const route = geo.routes.get(low(found.name));
            for (const end of [route.from, route.to]) { const at = geo.byName.get(low(end)); if (at) out.add(at.realm); }
        }
    }
    return [...out].sort();
}
