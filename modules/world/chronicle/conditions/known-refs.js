// Which place, route, region or realm a condition's `ref` names, read as the condition's scope (spec §1 ids and names, §2 Clearing
// scope). One reading for the store, the world line and the daily step: the packs' map as the step builds it (daily/geo.js: ids,
// names, aliases, realms, the Wilds, routes by name), so a key the store writes is the key the step reads. A place or region only the
// atlas knows (the story made it) is still a place or region. Pure.

import { foldKey } from '../../../../core/text.js';
import { ask } from '../queries-parts/shared-ask.js';
import { buildGeo } from '../../daily/geo.js';
import { resolveAs } from '../../daily/geo-scope.js';
import { readWorld } from '../world-daily/read-world.js';

const rows = (query, name, args) => { const out = ask(query, name, args); return Array.isArray(out) ? out : []; };
const fold = text => foldKey(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

/**
 * Whether a pack's file ids are read for `carrier`, the reply a narrator line is captured from (`ctx.carrier`): one with no
 * `packPlaceIds` rule mark was first read without them, and a Re-read of it stays so. With no carrier, yes.
 */
export const placeIdsOn = carrier => !carrier || carrier.rules?.includes('packPlaceIds') === true;

/** The packs' map as the daily step reads it, for `carrier` (placeIdsOn), or with `slugs` as given (a day step's own, daily/step.js). */
export const hostGeo = (query, carrier = null, { slugs = placeIdsOn(carrier) } = {}) => buildGeo(readWorld(query), { slugs });

// A place or region of the atlas alone (a place the story made): its own name.
function atlasName(query, scope, ref) {
    const key = fold(ref);
    for (const place of rows(query, 'atlas.places', {})) {
        if (scope === 'place' && [place?.name, ...(Array.isArray(place?.aliases) ? place.aliases : [])].some(each => text(each) && fold(each) === key)) return text(place.name);
        if (scope === 'region' && text(place?.region) && fold(place.region) === key) return text(place.region);
    }
    return null;
}

/** The name the story keeps `ref` under for `scope` (the pack's place, region, realm or route of that scope, else the atlas's), or null. */
export function knownRef(query, scope, ref, geo = hostGeo(query)) {
    if (!fold(ref)) return null;
    return resolveAs(geo, text(ref), scope)?.name ?? (scope === 'place' || scope === 'region' ? atlasName(query, scope, ref) : null);
}
