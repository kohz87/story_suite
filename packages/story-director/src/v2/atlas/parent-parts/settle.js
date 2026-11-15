// Assigning parent references and map coordinates to atlas places.

import { childOffset, keyOf, orderedPlaces, revOf, round3 as round } from '../domain.js';
import { packPlace, worldOf } from '../world.js';
import { parentOf } from './resolve.js';

export { childOffset };

/**
 * The middle `{ x, y }` of the placed places (finite x and y) whose region is `region` (compared by key), or null when there are none.
 * `places`: `[{ region, x, y }]`. The caller falls back to the last scene place, then to no coordinates.
 */
export function regionAnchor(places, region) {
    const want = keyOf(region);
    if (!want) return null;
    const placed = (Array.isArray(places) ? places : []).filter(place => keyOf(place?.region) === want && Number.isFinite(place.x) && Number.isFinite(place.y));
    if (!placed.length) return null;
    const sum = placed.reduce((acc, place) => ({ x: acc.x + place.x, y: acc.y + place.y }), { x: 0, y: 0 });
    return { x: round(sum.x / placed.length), y: round(sum.y / placed.length) };
}

const pointOf = place => (Number.isFinite(place?.x) && Number.isFinite(place?.y) ? { x: place.x, y: place.y } : null);
const around = (anchor, key) => {
    const { dx, dy } = childOffset(key);
    return { x: round(anchor.x + dx), y: round(anchor.y + dy) };
};

// The newest visited place that has a point (the scene's place before this one), or null; ties go to the later one.
function previousPlace(atlas, world, skip) {
    let best = null;
    for (const own of orderedPlaces(atlas)) {
        const seen = world.find(own.id);
        if (own.id === skip || !own.discovered || !pointOf(seen)) continue;
        if (!best || own.rev >= best.rev) best = { rev: own.rev, point: pointOf(seen) };
    }
    return best?.point ?? null;
}

// Rule 2 without a parent: the middle of the placed places of the region, else next to the previous place, else null.
function looseSpot(atlas, world, place) {
    const others = world.places.filter(other => other.id !== place.id && !other.hidden);
    const anchor = regionAnchor(others, place.region) ?? previousPlace(atlas, world, place.id);
    return anchor ? around(anchor, keyOf(place.name)) : null;
}

/**
 * Gives the atlas place `place` its `parent` and saved coordinates (rules 1 and 2): a parent from its saved `parent` or its name (made
 * with `ensure`, the caller's ensurePlace, when the story named a parent the map lacks) and the parent's point plus the child's fixed
 * offset; with no parent the region's middle, else the previous place, else nothing. A parent with no point is placed first. Coordinates
 * it gives are marked `auto` (a pack's win over them, a reader's edit clears the mark). Leaves a pack place and a place that has
 * coordinates as it is. `canMake`: whether the atlas has room for one more place. Returns whether anything changed.
 */
export function settlePlace(atlas, ctx, pack, place, { ensure, canMake = true, seen = new Set(), world: given } = {}) {
    if (!place || place.x !== undefined || packPlace(pack, place.name) || seen.has(place.id)) return false;
    seen.add(place.id);
    const world = given ?? worldOf(atlas, pack);
    const apart = { find: ref => { const found = world.find(ref); return found?.id === place.id ? null : found; } };
    const saved = place.parent ? apart.find(place.parent) : null;
    const found = saved ? { parent: saved, text: saved.name } : parentOf(place.name, apart);
    if (found && (found.parent || canMake)) {
        let own = found.parent?.atlasId ? atlas.places[found.parent.atlasId] : null;
        if (!own) {
            const made = ensure(atlas, ctx, pack, found.parent?.name ?? found.text, { discovered: false, region: place.region });
            own = made.place;
            const spot = made.created && !found.parent ? looseSpot(atlas, worldOf(atlas, pack), own) : null;
            if (spot) Object.assign(own, spot, { auto: true });
        } else if (!pointOf(world.find(own.id))) settlePlace(atlas, ctx, pack, own, { ensure, canMake, seen });
        const point = pointOf(worldOf(atlas, pack).find(own.id));
        // A place inside a town is in the town's region (the map shows it on the same layer).
        const region = place.region || found.parent?.region || own.region || '';
        if (place.parent === own.id && region === place.region && !point) return false;
        place.parent = own.id;
        place.region = region;
        if (point) Object.assign(place, around(point, keyOf(place.name)), { auto: true });
        place.rev = revOf(ctx);
        return true;
    }
    const spot = looseSpot(atlas, world, place);
    if (!spot) return false;
    Object.assign(place, spot, { auto: true });
    place.rev = revOf(ctx);
    return true;
}

/**
 * "Tidy the map": settlePlace for each visited atlas place that has no coordinates, a parent before its children. Returns how many got
 * coordinates (a place that only learns its parent is not counted: nothing can be drawn for it yet).
 */
export function tidyPlaces(atlas, ctx, pack, options) {
    const seen = new Set();
    let count = 0;
    // The joined world is built once and rebuilt only after a change (a place that settles to nothing changes nothing).
    let world = null;
    for (const own of orderedPlaces(atlas)) {
        const place = atlas.places[own.id];
        if (!place?.discovered || place.x !== undefined) continue;
        world ??= worldOf(atlas, pack);
        const changed = settlePlace(atlas, ctx, pack, place, { ...options, seen, world });
        if (changed) world = null;
        if (changed && place.x !== undefined) count += 1;
    }
    return count;
}
