// Story Director v2, atlas part: where a trip sets out from when the scene's place is not a mapped one (LF4-3).
// The narrator's own place ("Frontier Road south of Bluewatch") has no route, so the trip starts from the pack place the scene stands for
// (anchor.js: its town, its parent, the last pack place written in its region), else the last pack place the story visited. Pure: it reads
// the stored atlas and the packs only, so a replay picks the same place.

import { anchorOf, packRegions } from './anchor.js';
import { orderedPlaces } from './domain.js';

const joined = (world, id) => world.routes.some(route => route.from === id || route.to === id);

/** `startNode(world, atlas, pack, name, { query, region })` → the world place a trip from `name` starts at, or null. */
export function startNode(world, atlas, pack, name, { query = null, region = '' } = {}) {
    const own = world.find(name);
    if (own && joined(world, own.id)) return own;
    const anchor = anchorOf(world, atlas, pack, name, { region, regions: packRegions(query) });
    const named = anchor?.name ? world.find(anchor.name) : null;
    if (named && joined(world, named.id)) return named;
    let last = null;
    for (const visit of orderedPlaces(atlas)) {
        const seen = visit.discovered ? world.find(visit.id) : null;
        if (!seen || seen.source !== 'atlas' || !joined(world, seen.id) || !pack.places?.some(place => place.key === seen.key)) continue;
        if (!last || (visit.rev ?? -1) >= last.rev) last = { rev: visit.rev ?? -1, place: seen };
    }
    return last?.place ?? own ?? null;
}
