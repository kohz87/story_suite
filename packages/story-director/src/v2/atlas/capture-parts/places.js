// Creates or updates an atlas place from story or command inputs.

import { cleanName, findPlace, keyOf, newId, revOf } from '../domain.js';
import { recordRef } from '../canonical.js';
import { packPlace } from '../world.js';

/**
 * The atlas place for `name`, made when there is none: `{ place, created, changed }`.
 * A name the atlas lacks is looked up in the packs (by name or alias), and the pack's spelling,
 * region, kind and plane are used; its coordinates stay the pack's (read live, world.js), so
 * `coords` (the story's) are kept only for a place no pack knows.
 * `overwrite` (a landmark line, which says these on purpose): a given region, kind or layer
 * replaces the place's, and an empty one ('') clears it; one left out (undefined) keeps it.
 * Otherwise (the scene's place, a route's ends) they only fill empty fields, and a pack place's
 * region wins over the given one: the scene's region is the wider area the story is in ("River
 * Confederacy"), the pack's is where the place is ("Bluewatch Village"). A region that only
 * repeats the given one gives way to the pack's, so a place saved before this rule is mended.
 * A region set on purpose (a landmark line's, here; the reader's, commands.js) is marked `regionBy` on the place, and the mend leaves it.
 */
export function ensurePlace(atlas, ctx, pack, name, { discovered = true, region, kind, layer, coords = null, aliases = [], overwrite = false } = {}) {
    const given = cleanName(name);
    const fromPack = packPlace(pack, given);
    let place = findPlace(atlas, given) ?? (fromPack ? findPlace(atlas, fromPack.name) : null);
    const rev = revOf(ctx);
    let created = false;
    let changed = false;
    if (!place) {
        const id = newId(ctx, 'pl', atlas.places);
        const display = fromPack?.name ?? given;
        const first = (given, packs) => (overwrite && given !== undefined ? given : given || packs || '');
        place = {
            id, name: display, region: overwrite ? first(region, fromPack?.region) : fromPack?.region || region || '',
            ...(overwrite && region ? { regionBy: 'landmark' } : {}), kind: first(kind, fromPack?.kind), layer: first(layer, fromPack?.layer), discovered, rev,
        };
        if (coords && !fromPack) Object.assign(place, { x: Math.round(coords.x), y: Math.round(coords.y) });
        atlas.places[id] = place;
        atlas.keys[keyOf(display)] = id;
        if (!atlas.keys[keyOf(given)]) atlas.keys[keyOf(given)] = id;
        created = true;
        changed = true;
    } else {
        place = atlas.places[place.id];
        // Its writes are inside a place an older reply may have made: passed over on replay when that reply was deleted.
        if (typeof ctx.ifThere === 'function') ctx.ifThere('atlas', `/places/${place.id}`);
        if (discovered && !place.discovered) {
            place.discovered = true;
            changed = true;
        }
        for (const [field, given] of [['region', region], ['kind', kind], ['layer', layer]]) {
            let value = given;
            if (overwrite && field === 'region' && given && place.regionBy !== 'landmark' && place.regionBy !== 'reader') {
                place.regionBy = 'landmark';
                changed = true;
            }
            if (!overwrite && field === 'region' && fromPack?.region && !place.regionBy) {
                value = fromPack.region;
                // A region that only repeats the scene's is the scene's word, not the reader's: mend it.
                if (place.region && place.region === given && place.region !== value) {
                    place.region = value;
                    changed = true;
                    continue;
                }
            }
            if (overwrite ? value === undefined || place[field] === value : !value || place[field]) continue;
            place[field] = value;
            changed = true;
        }
        if (coords && !fromPack && place.x === undefined) {
            Object.assign(place, { x: Math.round(coords.x), y: Math.round(coords.y) });
            changed = true;
        }
        if (changed) place.rev = rev;
    }
    for (const alias of aliases.map(keyOf).filter(Boolean)) {
        if (!atlas.keys[alias]) {
            atlas.keys[alias] = place.id;
            changed = true;
        }
    }
    // The place's canonical identity (contract P24): its pack's content id, or itself; written once, never told to the model.
    recordRef(atlas, pack, place);
    return { place, created, changed };
}
