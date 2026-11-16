// Atlas visit, edit, and focus commands.

import { parseLocation } from '../../../places.js';
import {
    MAX_NAME, PACK_NODE, cleanName, cleanWord, findPlace, isRecord, keyOf, revOf,
} from '../domain.js';
import { settlePlace, tidyPlaces } from '../parent.js';
import { packWorld, worldOf } from '../world.js';
import { MAX_PLACES } from './limits.js';
import { ensurePlace } from './places.js';
import { asText, queryOf } from './shared-helpers.js';

/** `atlas.visit { name, kind?, region? }`: the story is at this place. */
export function visit(ctx, payload = {}) {
    if (!isRecord(payload) || typeof payload.name !== 'string') return ctx.fail('INVALID', 'Say which place: { name }.');
    const location = parseLocation(payload.name);
    const name = cleanName(location.name);
    if (!keyOf(name)) return ctx.fail('INVALID', 'The place has no name.');
    const atlas = ctx.draft('atlas');
    const pack = packWorld(queryOf(ctx));
    const { place, created, changed } = ensurePlace(atlas, ctx, pack, name, {
        discovered: true,
        region: cleanWord(payload.region),
        kind: cleanWord(payload.kind, { lower: true }),
        coords: location.coords,
    });
    // `parents`: the visit is from a reader that saves a place's parent and coordinates (beforeGenerate sends it); a visit recorded
    // before that has none, so a Re-read keeps the atlas it made.
    const settled = payload.parents === true && settlePlace(atlas, ctx, pack, place, { ensure: ensurePlace, canMake: Object.keys(atlas.places).length < MAX_PLACES });
    return { summary: changed || settled ? `${place.name} is on the map.` : '', narrate: false, data: { place: place.id, created } };
}

const EDIT_FIELDS = ['place', 'name', 'x', 'y', 'layer', 'region', 'kind', 'tidy'];

// `atlas.edit { tidy: true }` ("Tidy the map"): saved coordinates for the visited places that have none, as one reader action.
function tidy(ctx, atlas) {
    const count = tidyPlaces(atlas, ctx, packWorld(queryOf(ctx)), { ensure: ensurePlace, canMake: Object.keys(atlas.places).length < MAX_PLACES });
    if (!count) return ctx.fail('INVALID', 'None of the places without coordinates can be placed yet.');
    return { summary: `${count} ${count === 1 ? 'place' : 'places'} placed on the map.`, narrate: false, data: { tidied: count } };
}

/** `atlas.edit { place, name?, x?, y?, layer?, region?, kind? }`: the reader's corrections. */
export function edit(ctx, payload = {}) {
    if (!isRecord(payload)) return ctx.fail('INVALID', 'Say which place to change: { place, … }.');
    const unknown = Object.keys(payload).filter(key => !EDIT_FIELDS.includes(key));
    if (unknown.length) return ctx.fail('INVALID', `The map cannot change ${unknown.join(', ')}.`);
    const atlas = ctx.draft('atlas');
    if (payload.tidy === true && Object.keys(payload).length === 1) return tidy(ctx, atlas);
    let ref = payload.place;
    let found = findPlace(atlas, ref);
    // A pack place picked on the map: the reader's change makes it the atlas's.
    const pack = packWorld(queryOf(ctx));
    if (!found && typeof ref === 'string' && ref.startsWith(PACK_NODE)) ref = ref.slice(PACK_NODE.length);
    const fromPack = !found ? worldOf(atlas, pack).find(ref) : null;
    if (!found && !fromPack) return ctx.fail('NOT_FOUND', `There is no place "${asText(payload.place)}" on the map.`);
    const changes = [];
    const fields = {};
    if (payload.name !== undefined) {
        const name = cleanName(asText(payload.name));
        if (!keyOf(name)) return ctx.fail('INVALID', 'A place needs a name.');
        if (asText(payload.name).trim().length > MAX_NAME) return ctx.fail('INVALID', `A name has at most ${MAX_NAME} characters.`);
        fields.name = name;
    }
    for (const field of ['layer', 'region', 'kind']) {
        if (payload[field] === undefined) continue;
        if (typeof payload[field] !== 'string') return ctx.fail('INVALID', `The ${field} must be text.`);
        fields[field] = cleanWord(payload[field], { lower: field === 'kind' });
    }
    const hasX = payload.x !== undefined;
    const hasY = payload.y !== undefined;
    if (hasX !== hasY) return ctx.fail('INVALID', 'Give both coordinates, x and y (or both empty to clear them).');
    if (hasX && !((payload.x === null && payload.y === null) || [payload.x, payload.y].every(value => typeof value === 'number' && Number.isFinite(value)))) {
        return ctx.fail('INVALID', 'Coordinates are two numbers (or both empty to clear them).');
    }
    if (!Object.keys(fields).length && !hasX) return ctx.fail('INVALID', 'Nothing to change.');

    const place = found ? atlas.places[found.id] : ensurePlace(atlas, ctx, pack, fromPack.name, { discovered: false }).place;
    if (fields.name !== undefined && fields.name !== place.name) {
        const key = keyOf(fields.name);
        const owner = worldOf(atlas, pack).find(fields.name);
        if (owner && owner.id !== place.id) return ctx.fail('REFUSED', `There is already a place called ${owner.name}.`);
        changes.push(`now called ${fields.name}`);
        place.name = fields.name;
        atlas.keys[key] = place.id;   // the old name stays an alias
    }
    for (const field of ['layer', 'region', 'kind']) {
        if (fields[field] === undefined || fields[field] === place[field]) continue;
        place[field] = fields[field];
        changes.push(fields[field] ? `${field} ${fields[field]}` : `no ${field}`);
    }
    if (hasX) {
        if (payload.x === null) {
            if (place.x !== undefined) changes.push('no coordinates');
            delete place.x;
            delete place.y;
            delete place.auto;
        } else {
            const x = Math.round(payload.x);
            const y = Math.round(payload.y);
            if (place.x !== x || place.y !== y) changes.push(`at ${x}, ${y}`);
            Object.assign(place, { x, y });
            delete place.auto;   // the reader's point: a pack's no longer wins over it
        }
    }
    place.rev = revOf(ctx);
    return { summary: changes.length ? `${place.name}: ${changes.join(', ')}.` : '', narrate: false, data: { place: place.id } };
}

/**
 * `atlas.focus { node }`: marks the place picked on the map for the screen. `node: null` clears
 * it; a node that is not on the map changes nothing (no error: a click never fails).
 */
export function focus(ctx, payload = {}) {
    const atlas = ctx.draft('atlas');
    const node = isRecord(payload) ? payload.node : undefined;
    if (node === null) {
        atlas.focus = null;
        return { summary: '', narrate: false, data: { node: null } };
    }
    const place = typeof node === 'string' ? worldOf(atlas, packWorld(queryOf(ctx))).find(node) : null;
    if (!place || place.id !== node) return { summary: '', narrate: false, data: { node: atlas.focus } };
    atlas.focus = place.id;
    return { summary: '', narrate: false, data: { node: place.id } };
}
