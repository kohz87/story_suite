// The map's or a pack's record of a place by name or alias, for the kind and region a move leaves out. Pure.

import { foldKey } from '../../../text.js';

const ask = (ctx, name, args) => { try { return ctx.query(name, args); } catch { return null; } };
const rowsOf = (ctx, name, args) => { const rows = ask(ctx, name, args); return Array.isArray(rows) ? rows : []; };

// The map's places (the atlas's, else none; then the packs'), for resolving names and aliases.
export function knownPlaces(ctx) {
    return [...rowsOf(ctx, 'atlas.places', {}), ...rowsOf(ctx, 'packs.content', { kind: 'places' })];
}

const named = (place, key) => [place?.name, ...(Array.isArray(place?.aliases) ? place.aliases : [])].some(other => typeof other === 'string' && foldKey(other) === key);

// The place a name or alias is, or null: the atlas's record (`atlas.place` resolves aliases; its list has names only), else a pack's.
// The atlas's kind and region win; but when a pack gives the place another region, the pack's is used: the atlas's differs by a
// landmark line, and a scene saying it would have Story Director's mend put the pack's region back on the map.
export function knownPlace(ctx, name) {
    const key = foldKey(name);
    if (!key) return null;
    const detail = ask(ctx, 'atlas.place', { name });
    const atlas = detail && typeof detail === 'object' ? detail : rowsOf(ctx, 'atlas.places', {}).find(place => named(place, key)) ?? null;
    const keys = [key, foldKey(atlas?.name ?? '')].filter(Boolean);
    const pack = rowsOf(ctx, 'packs.content', { kind: 'places' }).find(place => keys.some(each => named(place, each))) ?? null;
    if (!atlas) return pack;
    const packRegion = typeof pack?.region === 'string' && pack.region.trim() ? pack.region : '';
    return packRegion && atlas.region !== packRegion ? { ...atlas, region: packRegion } : atlas;
}
