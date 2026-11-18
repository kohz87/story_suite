// World events, the names a pack event may point at: the pack's places, routes, regions, realms (and the Wilds),
// powers, scores, conditions and cast, read from `packs.content`. A kind the pack does not carry is left out, and
// a reference into it is not checked (an older pack with no realms still loads). Names compare without case.

import { worldOn } from '../world-calls.js';

export const WILDS = 'the wilds';
const lower = value => String(value).trim().toLowerCase();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const namesOf = row => (isRecord(row) ? [row.name, row.id, ...(Array.isArray(row.aliases) ? row.aliases : [])].filter(value => typeof value === 'string' && value.trim()) : []);

function rows(view, kind) {
    try {
        const list = view?.query?.('packs.content', { kind });
        return Array.isArray(list) ? list : null;
    } catch { return null; }
}

/** The reference sets of a view (each a Set of lower-case names, or absent). */
export function packRefs(view) {
    const refs = {};
    const add = (kind, key, pick = namesOf) => {
        const list = rows(view, kind);
        if (list) refs[key] = new Set(list.flatMap(pick).map(lower));
    };
    add('places', 'places');
    add('routes', 'routes', row => [...namesOf(row), ...(isRecord(row) && row.from && row.to ? [`${row.from}-${row.to}`, `${row.from} to ${row.to}`] : [])]);
    add('realms', 'realms');
    add('powers', 'powers');
    add('scores', 'scores');
    add('conditions', 'conditions');
    add('cast', 'cast');
    const places = rows(view, 'places');
    const realms = rows(view, 'realms');
    if (places || realms) refs.regions = new Set([WILDS, ...(places ?? []).map(row => row?.region), ...(realms ?? []).flatMap(row => (isRecord(row) && Array.isArray(row.regions) ? row.regions : []))].filter(value => typeof value === 'string' && value.trim()).map(lower));
    if (refs.realms) refs.realms.add(WILDS);
    return refs;
}

/** What `normalizeEvents` gets: `{ world: false }` with the switch off (the base is untouched), else the switch plus the pack's names. */
export const worldOptions = view => (worldOn(view) ? { world: true, refs: packRefs(view) } : { world: false });

/** Does `name` exist as one of `kinds` ('places', 'routes', 'regions', 'realms', 'powers', 'scores', 'conditions', 'cast', 'events', 'facts')? Not checked when none of those kinds is known. */
export function knows(refs, kinds, name) {
    const sets = kinds.map(kind => refs?.[kind]).filter(Boolean);
    return sets.length === 0 || sets.some(set => set.has(lower(name)));
}
