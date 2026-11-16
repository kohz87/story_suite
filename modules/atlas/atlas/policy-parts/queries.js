// Read-only queries for atlas policy, canonical places, candidates, and area danger tier.

import { findPlace, keyOf } from '../domain.js';
import { canonicalOf, definitionsFor } from '../canonical.js';
import { packWorld } from '../world.js';
import { scenePlace } from '../note.js';
import { parseLocation } from '../../places.js';
import { dangerOf, policyProjection } from './projection.js';

const toolsQuery = tools => (typeof tools?.query === 'function' ? (name, args) => tools.query(name, args) : null);
const atlasOf = state => state?.domains?.atlas ?? { places: {}, routes: {}, keys: {}, focus: null };

/** The scene's place, as a name the atlas can resolve (null when the scene is nowhere). */
function sceneRef(state, tools) {
    const name = parseLocation(scenePlace({ state, query: toolsQuery(tools) }).name).name.trim();
    return keyOf(name) ? name : null;
}

export function canonicalQuery(state, { id, name } = {}, tools) {
    const atlas = atlasOf(state);
    const pack = packWorld(toolsQuery(tools));
    if (id !== undefined && id !== null) return typeof id === 'string' ? canonicalOf(atlas, pack, id) : null;
    if (name !== undefined && name !== null) return typeof name === 'string' ? canonicalOf(atlas, pack, name) : null;
    return canonicalOf(atlas, pack, sceneRef(state, tools));
}

export function candidatesQuery(state, { place } = {}, tools) {
    if (typeof place !== 'string' || !place) return null;
    const atlas = atlasOf(state);
    const own = findPlace(atlas, place);
    if (!own) return null;
    return { place: own.id, definitions: definitionsFor(atlas, packWorld(toolsQuery(tools)), own.id) };
}

/** `world.areaTier({place})`: the canonical place, then place -> region -> world; the first policy found wins. Unknown holds generation. */
export function areaTier(state, { place } = {}, tools) {
    const atlas = atlasOf(state);
    const canonical = typeof place === 'string' && place ? canonicalOf(atlas, packWorld(toolsQuery(tools)), place) : null;
    const unknown = { place: canonical?.id ?? (typeof place === 'string' ? place : null), tier: null, source: 'unknown', sourceId: null, allowedFoes: [], allowedTags: [], lore: [] };
    if (!canonical) return unknown;
    const danger = dangerOf(atlas);
    const found = (policy, source, sourceId) => ({ place: canonical.id, tier: policy.tier, source, sourceId, allowedFoes: [...policy.allowedFoes], allowedTags: [...policy.allowedTags], lore: [...policy.lore] });
    if (danger.places[canonical.id]) return found(danger.places[canonical.id], 'place', canonical.id);
    const region = atlas.placeRegions?.[canonical.id] ?? null;
    if (region && danger.regions[region]) return found(danger.regions[region], 'region', region);
    if (danger.world) return found(danger.world, 'world', null);
    return { ...unknown, place: canonical.id };
}

export const queries = {
    'atlas.policy': state => policyProjection(atlasOf(state)),
    'atlas.canonical': canonicalQuery,
    'atlas.candidates': candidatesQuery,
    'world.areaTier': areaTier,
};
