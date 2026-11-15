// Matches pack candidates and keys for atlas places.

import { keyOf } from '../domain.js';

/** The pack candidates that answer to a name key (by name or alias). */
export const byKey = (candidates, key) => (candidates ?? []).filter(candidate => candidate.key === key || candidate.aliases.includes(key));

/** The keys an own place answers to: its name and every alias the atlas keeps for it. */
export function keysOf(atlas, place) {
    return [keyOf(place.name), ...Object.entries(atlas?.keys ?? {}).filter(([, id]) => id === place.id).map(([alias]) => alias)].filter((key, at, all) => key && all.indexOf(key) === at);
}

/** The pack definitions an own place could be: the candidates answering to any of its keys, each once, in id order. */
export function candidatesOf(atlas, pack, place) {
    const found = new Map();
    for (const key of keysOf(atlas, place)) for (const candidate of byKey(pack?.candidates, key)) found.set(candidate.id, candidate);
    return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

export const refsOf = atlas => (atlas?.placeRefs && typeof atlas.placeRefs === 'object' ? atlas.placeRefs : {});
