// Resolving place containment and travel days between locations.

import { atParty, samePlace } from '../entries.js';

const heads = text => [...new Set([String(text ?? '').trim(), ...String(text ?? '').split(/\s*\/\s*/).map(part => part.trim())])].filter(Boolean);

/**
 * Days of travel from the place `where` to the party's place: 0 when they are in one area (the party's place or region, or the same
 * town before a "/"), null when nothing says how far it is. `travel(from, to)` → days or null (the atlas's trip, atlas.travel).
 */
export function daysBetween(where, party, travel) {
    if (!where || !party?.place) return null;
    if (atParty(where, party) || samePlace(heads(where)[1] ?? where, heads(party.place)[1] ?? party.place)) return 0;
    if (typeof travel !== 'function') return null;
    for (const from of heads(where)) {
        for (const to of heads(party.place)) {
            let days = null;
            try { days = travel(from, to); } catch { days = null; }
            if (Number.isFinite(days) && days >= 0) return days;
        }
    }
    return null;
}

// ---- reach, rule 2 (pulse steps with `reach: 2`, `reach: 3` and every hook choice, which is stored as the reply's payload) -------------
// Rule 1 (pulse steps with `reach: 1`, replayed as they were) took a place in the party's region for the party's place and the atlas's
// first answer, a straight-line estimate too: "Drowned Bell taproom", a place the map placed itself with no road, was half a day from
// Auvoth at the reader's map scale (one km a unit) though the road is 3.5 days, so Rika was met there 1.2 days after the start.
// Rule 2 as merged (`party.old`: the steps with `reach: 2`; a party with no atlas reader, `locate`) read a town as a name one place's name
// holds; the rest reads places by the atlas's ids and saved parent links (`party.locate`, entries.js `locator`), never a region.

const townPart = name => (String(name ?? '').includes('/') ? heads(name)[1] : '');
const merged = party => party.old || typeof party.locate !== 'function';
const spotOf = (name, party) => party.locate(name) ?? { key: '', name: '', open: false, up: [] };
// The party's spot: its own map kind (`party.open`) and, when the atlas gave no parent, the town of its place line (`party.town`).
function partySpot(party) {
    const spot = spotOf(party.place, party);
    const town = !spot.up.length && party.town ? spotOf(party.town, party) : null;
    return { ...spot, open: typeof party.open === 'boolean' ? party.open : spot.open, up: town?.key && town.key !== spot.key ? [{ key: town.key, name: town.name, open: town.open }, ...town.up] : spot.up };
}
// The town a spot stands in: the outermost place it sits in, never across a road or wilderness (an open place is only itself).
function townOf(spot) {
    let town = spot;
    if (!spot.open) for (const up of spot.up) { if (up.open) break; town = up; }
    return town;
}

/**
 * Whether someone at `where` is where the party is: the same place, or (the party not on a road or in a wilderness) someone not on one either in
 * the town the party's place stands in, by the atlas's ids and saved parent links (else the written "Town / Spot", else the party's place line):
 * "Bluewatch Village / Guild Office" and "Bluewatch Village". A region is no town ("Drowned Bell taproom", region "bluewatch", no parent: only
 * itself); a road or wilderness (`party.open`) is only itself and the places in it; one name holding another is nothing. `party.old` or no
 * `party.locate`: rule 2 as merged.
 */
export function atPlace(where, party) {
    if (!where || !party?.place) return false;
    if (merged(party)) {
        const mine = townPart(where) || where;
        return samePlace(where, party.place) || samePlace(mine, party.place) || [townPart(party.place), party.town].some(town => town && samePlace(mine, town));
    }
    const here = partySpot(party);
    const there = spotOf(where, party);
    if (!there.key || !here.key) return false;
    if (there.key === here.key) return true;
    if (here.open) return there.up.some(up => up.key === here.key);
    return !there.open && townOf(there).key === townOf(here).key;
}

/**
 * Days from `where` to the party by known roads: 0 at its place (`atPlace`), else the longest road trip between the place (or its town) and
 * the party's place (or its town; a road or wilderness: itself only); null when no road says. `travel(from, to)` gives road trips only
 * (entries.js `roadsOf`): a straight-line estimate is no answer, its scale is the reader's map setting and not the world's roads.
 */
export function reachDays(where, party, travel) {
    if (!where || !party?.place) return null;
    if (atPlace(where, party)) return 0;
    if (typeof travel !== 'function') return null;
    const old = merged(party);
    const froms = old ? [where, townPart(where)] : [where, townOf(spotOf(where, party)).name];
    const tos = old ? [party.place, townPart(party.place), party.town] : [party.place, townOf(partySpot(party)).name];
    let most = null;
    for (const from of new Set(froms.filter(Boolean))) {
        for (const to of new Set(tos.filter(Boolean))) {
            let days = null;
            try { days = travel(from, to); } catch { days = null; }
            if (Number.isFinite(days) && days >= 0) most = Math.max(most ?? 0, days);
        }
    }
    return most;
}
