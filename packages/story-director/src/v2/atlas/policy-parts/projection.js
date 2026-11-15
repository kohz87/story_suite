// Building the read-only atlas policy projection and danger view.

import { hashJson } from '../../hash.js';

const sortedBy = table => Object.fromEntries(Object.keys(table ?? {}).sort().map(key => [key, table[key]]));
const emptyDanger = { world: null, regions: {}, places: {} };

/** The danger of an atlas as stored (an older save has none). */
export const dangerOf = atlas => ({ world: atlas?.danger?.world ?? null, regions: atlas?.danger?.regions ?? {}, places: atlas?.danger?.places ?? {} });

/** `atlas.policy`: `{ regions: Region[] (by id), placeRegions, placeRefs, danger, hash }`; the hash covers all but itself (never the writes). */
export function policyProjection(atlas) {
    const danger = dangerOf(atlas ?? { danger: emptyDanger });
    const body = {
        regions: Object.keys(atlas?.regions ?? {}).sort().map(id => ({ id, name: atlas.regions[id].name, aliases: [...atlas.regions[id].aliases] })),
        placeRegions: sortedBy(atlas?.placeRegions),
        placeRefs: sortedBy(atlas?.placeRefs),
        danger: { world: danger.world, regions: sortedBy(danger.regions), places: sortedBy(danger.places) },
    };
    return { ...structuredClone(body), hash: hashJson(body) };
}
