// The map's or a pack's record of a place by name or alias, for the kind and region a move leaves out. Pure.

import { foldKey } from '../../../text.js';

// The map's places (the atlas's, else none; then the packs'), for resolving names and aliases.
export function knownPlaces(ctx) {
    const ask = (name, args) => { try { const rows = ctx.query(name, args); return Array.isArray(rows) ? rows : []; } catch { return []; } };
    return [...ask('atlas.places', {}), ...ask('packs.content', { kind: 'places' })];
}

// The first known place whose name or alias is `name`, or null.
export function knownPlace(ctx, name) {
    const key = foldKey(name);
    if (!key) return null;
    const names = place => [place?.name, ...(Array.isArray(place?.aliases) ? place.aliases : [])];
    return knownPlaces(ctx).find(place => names(place).some(other => typeof other === 'string' && foldKey(other) === key)) ?? null;
}
