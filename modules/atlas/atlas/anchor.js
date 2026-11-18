// Story Director v2, atlas part: the pack place a scene's place stands for (LAB2-3; pure). A scene the story set somewhere no pack
// names ("The Sled & Winch", a tavern in Auvoth) is still somewhere on the pack's map: the world's conditions, routes and news read
// it as that place, so they are the same in the tavern as in the town. The first rule that gives a pack place wins:
//   'pack'   the name is a pack place (or one of its names);
//   'town'   its town part is one ("Auvoth · Southern Gatehouse", "Auvoth / Pale Market Inn", "Pale Market Inn in Auvoth");
//   'parent' the place the atlas saved it in (its `parent`, up a few steps) is one;
//   'last'   the pack place last written on the map (the highest `rev`) in its region (the atlas's, else the scene's);
//   'region' none of those: the region alone (`name` '').
// Null when the name is empty or none of them knows anything. Reads only the stored atlas and the packs, so it is the same on replay.

import { parseLocation } from '../places.js';
import { keyOf, orderedPlaces } from './domain.js';
import { parentOf } from './parent.js';
import { packPlace } from './world.js';

const STEPS = 4;

/** The packs' regions an anchor reads (`packs.content` kind regions: `{ id, name, aliases? }`), [] when the packs cannot say. */
export function packRegions(query) {
    if (typeof query !== 'function') return [];
    try { const out = query('packs.content', { kind: 'regions' }); return Array.isArray(out) ? out : []; } catch { return []; }
}

/**
 * `anchorOf(world, atlas, pack, name, { region, regions })` → `{ name, region, via }` or null. `world`: worldOf(atlas, pack); `atlas`: the
 * atlas domain (or null); `pack`: packWorld's `{ places }`; `region`: the scene's own region, used when the atlas has no place yet.
 */
export function anchorOf(world, atlas, pack, name, { region = '', regions = [] } = {}) {
    // A region by its id, name or alias (`regions`: the packs' `{ id, name, aliases }`): a scene keeps a pack region's name, the pack's places its id (SFF4 #3).
    const regionKey = text => {
        const key = keyOf(String(text ?? ''));
        const known = (Array.isArray(regions) ? regions : []).find(row => [row?.id, row?.name, ...(Array.isArray(row?.aliases) ? row.aliases : [])].some(word => typeof word === 'string' && keyOf(word) === key));
        return known ? keyOf(known.id) : key;
    };
    const raw = String(name ?? '').trim();
    if (!keyOf(raw) || typeof world?.find !== 'function') return null;
    const packOf = place => (place ? packPlace(pack, place.name) && world.find(place.name) : null);
    const out = (place, via) => ({ name: place.name, region: String(place.region ?? ''), via });
    // "The Sled & Winch" is the atlas's "Sled & Winch" (the scene drops a leading article).
    const own = world.find(raw) ?? world.find(raw.replace(/^the\s+/i, ''));
    if (packOf(own)) return out(own, 'pack');
    const town = parseLocation(raw).name.trim();
    const byTown = (town && keyOf(town) !== keyOf(raw) ? packOf(world.find(town)) : null) ?? packOf(parentOf(raw, world)?.parent ?? null);
    if (byTown) return out(byTown, 'town');
    let up = own;
    for (let step = 0; step < STEPS && up?.parent; step += 1) {
        up = world.find(up.parent);
        if (packOf(up)) return out(up, 'parent');
    }
    const where = String(own?.region || region || '').trim();
    if (!keyOf(where)) return null;
    let last = null;
    for (const visit of orderedPlaces(atlas)) {
        const seen = visit.discovered ? packOf(world.find(visit.id)) : null;
        if (!seen || regionKey(seen.region) !== regionKey(where)) continue;
        if (!last || (visit.rev ?? -1) >= last.rev) last = { rev: visit.rev ?? -1, place: seen };
    }
    return last ? out(last.place, 'last') : { name: '', region: where, via: 'region' };
}
