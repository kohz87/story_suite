// World events, the daily step: where the party is against the pack's map. Two regions are neighbours when a route joins a place in
// one to a place in the other (worked out once per built map). The party's region is `ws.party` (a region key, or null when it is not
// known: then every `in:` / `near:` term is false). A region is read by its id, name or alias. Pure (reads `ws`).

import { resolveRef } from './geo.js';

const low = text => String(text ?? '').trim().toLowerCase();
const maps = new WeakMap();

/** The one key a region goes by on this map (by id, name or alias), or null for no region of it. */
export function regionKey(geo, ref) {
    const key = low(ref);
    if (!key) return null;
    const shown = geo.regionNames.get(key);
    const same = shown ? [...geo.regions.keys()].find(each => geo.regionNames.get(each) === shown) : null;
    return same ?? (geo.regions.has(key) ? key : null);
}

/** Region key → the Set of its neighbours' keys, from the pack's routes. */
export function neighbourRegions(geo) {
    let out = maps.get(geo);
    if (out) return out;
    out = new Map();
    const note = (a, b) => out.set(a, (out.get(a) ?? new Set()).add(b));
    for (const route of new Set(geo.routes.values())) {
        const [a, b] = [route.from, route.to].map(end => regionKey(geo, geo.byName.get(low(end))?.region));
        if (!a || !b || a === b) continue;
        note(a, b);
        note(b, a);
    }
    maps.set(geo, out);
    return out;
}

/** The regions a `where` list covers: a place's region, a region itself, every region of a realm. */
function whereRegions(geo, refs) {
    const out = [];
    for (const ref of refs ?? []) {
        const found = resolveRef(geo, ref);
        if (found?.kind === 'place') out.push(found.place.region);
        else if (found?.kind === 'region') out.push(found.name);
        else if (!found) { if (regionKey(geo, ref)) out.push(ref); } // a region by its name or alias
        else if (found.kind === 'realm') {
            for (const [region, realm] of geo.regionRealm) if (realm === found.name) out.push(region);
            for (const place of geo.places) if (place.realm === found.name) out.push(place.region);
        }
    }
    return out;
}

// Whether the party is in one of `regions` ('in'), or in one of them or a neighbour of one ('near').
function partyIs(ws, term, regions) {
    if (!ws.party) return false;
    return regions.map(region => regionKey(ws.geo, region)).some(key => key && (key === ws.party || (term === 'near' && Boolean(neighbourRegions(ws.geo).get(key)?.has(ws.party)))));
}

/** A parsed party term (grammar.js partyTerm) today; "@region" is the bound pick's region, else the regions of the event's `where` list. */
export function termHolds(ws, parsed, def, bind) {
    if (!parsed.own) return partyIs(ws, parsed.term, [parsed.ref]);
    return partyIs(ws, parsed.term, bind?.place ? [bind.region] : whereRegions(ws.geo, def?.where?.refs));
}

/** Whether the party is where a `waits_for` (`{ term, regions }`; null regions: the event's `where`) asks. */
export const waitMet = (ws, def) => partyIs(ws, def.waitsFor.term, def.waitsFor.regions ?? whereRegions(ws.geo, def.where?.refs));
