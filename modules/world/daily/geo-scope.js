// World events, the daily step: scope on the map (spec §2 Scope hierarchy, Clearing scope, placeStatus groups; §3 Caps): the refs
// that contain a ref, narrow → broad; a ref read as one scope; a place with the districts under it; and the realms (or the Wilds) an
// event's `where` takes slots in. Pure.

import { WILDS, resolveRef } from './geo.js';

const low = text => String(text ?? '').trim().toLowerCase();

/**
 * The refs that contain `ref`, narrow → broad: a place, the place it sits under (a district's city), its region, its realm; a region
 * and its realm; a realm; a route alone.
 */
export function ancestors(geo, ref) {
    const found = resolveRef(geo, ref);
    if (!found) return [];
    if (found.kind === 'place') {
        const parent = found.place.parent ? geo.byName.get(low(found.place.parent)) : null;
        return [found.name, parent?.name, found.place.region, found.place.realm].filter(Boolean);
    }
    if (found.kind === 'region') return [found.name, geo.regionRealm.get(low(found.name)) ?? WILDS];
    return [found.name];
}

/**
 * `ref` read as `kind` (a condition's scope fixes which refs it takes, spec §2 Clearing scope): `{ kind, name, place? }` or null.
 * A display name shared by a place and a region finds the one of that kind.
 */
export function resolveAs(geo, ref, kind) {
    const key = low(ref);
    if (!key) return null;
    if (kind === 'place') return geo.byName.has(key) ? { kind, name: geo.byName.get(key).name, place: geo.byName.get(key) } : null;
    if (kind === 'region') return geo.regions.has(key) ? { kind, name: geo.regions.get(key) } : null;
    if (kind === 'realm') return geo.realms.has(key) ? { kind, name: geo.realms.get(key) } : key === low(WILDS) ? { kind, name: WILDS } : null;
    if (kind === 'route') return geo.routes.has(key) ? { kind, name: geo.routes.get(key).name } : null;
    return null;
}

/** A place and every place under it (its districts), by name: what a placeStatus on it covers. [] for no such place. */
export function groupOf(geo, name) {
    const place = geo.byName.get(low(name));
    if (!place) return [];
    return [place.name, ...geo.places.filter(other => other.parent === place.name).map(other => other.name)];
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
