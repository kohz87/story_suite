// Story Director v2, part **cast**: resolving places, atlas parent chains, and the party's current location.

import { MAX_PLACE, cutPoints, flat } from '../domain.js';
import { ask } from './query.js';

const MIN_NAME = 3;

const normalize = value => flat(value).toLowerCase();

/** Whether two place names are the same place, the way v1 reads them: one holds the other (at least three letters). */
export function samePlace(a, b) {
    const one = normalize(a);
    const two = normalize(b);
    if (one.length < MIN_NAME || two.length < MIN_NAME) return false;
    return one === two || one.includes(two) || two.includes(one);
}

// Map kinds where no town stands: a road, a wilderness ("Old Rut-Line", kind wild); it is never "in" a town, whatever its parent. (Not the pulse's
// place groups: those fold a gate, a dock or a port, which stand in towns, into road and water.) A kind with a settlement word ("forest village",
// "hill fort", "mountain hold") is a town, whatever else it says.
const OPEN_WORDS = new Set(['wild', 'wilderness', 'road', 'trail', 'track', 'path', 'forest', 'wood', 'woods', 'mountain', 'mountains', 'hill', 'hills', 'moor', 'marsh', 'swamp', 'plain', 'plains', 'valley', 'grove', 'pass', 'ford', 'bluff', 'desert', 'wasteland', 'camp', 'field', 'fields', 'crossroads', 'ruin', 'ruins']);
const TOWN_WORDS = new Set(['town', 'village', 'city', 'hold', 'fort', 'fortress', 'settlement', 'hamlet', 'keep', 'castle', 'capital', 'citadel', 'stronghold', 'outpost', 'district', 'quarter', 'ward']);
const isOpen = kind => {
    const words = String(kind ?? '').toLowerCase().split(/[\s/,;|-]+/);
    return words.some(word => OPEN_WORDS.has(word)) && !words.some(word => TOWN_WORDS.has(word));
};
const townOfLine = (line, place) => {
    const town = typeof line === 'string' && line.includes(' · ') ? cutPoints(flat(line.split(' · ')[0]), MAX_PLACE) : '';
    return town && normalize(town) !== normalize(place) ? town : '';
};

// ---- the reach rule's places (world.js `atPlace`, `reach: 3`): the atlas's ids and saved parent links, never names or regions ------------

const ARTICLE = /^the\s+/i;
const UP_MAX = 3;

/**
 * `locate(name)` for a party: a place's spot `{ key, name, open, up }`. `key`: the atlas's id for it (`id:<id>`), else its whole name (`name:<name>`,
 * a leading "the" dropped); `open`: a road or wilderness by its map kind; `up`: the places it sits in, nearest first (`{ key, name, open }`, three at
 * most), by the parent the atlas saved for it (`atlas.place` `parent`, an id), else, as rule 2 as merged read it, the town a name writes first
 * ("Auvoth / Pale Market": Auvoth); else nothing. A region never names a town, and one name holding another, or starting with it, is nothing:
 * "Drowned Bell taproom" (region "bluewatch", no parent saved) sits in no town, and "Rosefen" (region "Valegard") not in Valegard.
 * Answers are kept for the party's life (one reply's frame or step).
 */
export function locator(query) {
    const memo = new Map();
    const find = name => (name ? ask(query, 'atlas.place', { name }, null) ?? (ARTICLE.test(name) ? ask(query, 'atlas.place', { name: name.replace(ARTICLE, '') }, null) : null) : null);
    const spotOf = (name, found, chain) => {
        const spot = { key: found?.id ? `id:${found.id}` : `name:${normalize(name).replace(ARTICLE, '')}`, name: cutPoints(flat(found?.name), MAX_PLACE) || name, open: isOpen(found?.kind), up: [] };
        if (chain.has(spot.key)) return spot;
        chain.add(spot.key);
        const saved = found?.parent ? ask(query, 'atlas.place', { id: found.parent }, null) : null;
        const written = !found?.parent && name.includes('/') ? cutPoints(flat(name.split('/')[0]), MAX_PLACE) : '';
        const parent = saved ? spotOf(cutPoints(flat(saved.name), MAX_PLACE), saved, chain) : written ? locate(written, chain) : null;
        if (parent && parent.key !== spot.key) spot.up = [{ key: parent.key, name: parent.name, open: parent.open }, ...parent.up.filter(up => up.key !== spot.key)].slice(0, UP_MAX);
        return spot;
    };
    const locate = (raw, chain = new Set()) => {
        const name = cutPoints(flat(raw), MAX_PLACE);
        if (!name) return null;
        if (!memo.has(name)) memo.set(name, spotOf(name, find(name), chain));
        return memo.get(name);
    };
    return name => locate(name);
}

/**
 * The place and region the party is in: `{ place, region, town, open, locate }` (the atlas's, else Story Block's scene), '' for none. `town`: the town
 * the atlas has the place in (its place line "Town · Spot"); `open`: it is a road or wilderness (its own map kind); `locate`: `locator(query)`.
 */
export function partyPlace(query, state) {
    const atlas = ask(query, 'atlas.here', {}, null);
    const scene = ask(query, 'scene.place', {}, null) ?? state?.domains?.scene?.place ?? null;
    const place = cutPoints(flat(atlas?.name) || flat(scene?.name), MAX_PLACE);
    const kind = atlas ? atlas.placeKind || atlas.kind : scene?.kind;
    return { place, region: cutPoints(flat(atlas?.region) || flat(scene?.region), MAX_PLACE), town: townOfLine(atlas?.line, place), open: isOpen(kind), locate: locator(query) };
}

/** Whether someone at `where` is at the party's place (or in its region). */
export const atParty = (where, party) => Boolean(where) && (samePlace(where, party?.place) || samePlace(where, party?.region));
