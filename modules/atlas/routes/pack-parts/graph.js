// Queries exits and connecting edges between places in a world pack.

import { indexOf } from './index.js';
import { resolvePlace } from './places.js';

export function exitsFrom(pack, place) {
    const name = resolvePlace(pack, place);
    if (!name) return [];
    return indexOf(pack).adjacency.get(name).map(edge => ({
        to: edge.a === name ? edge.b : edge.a,
        km: edge.km,
        code: edge.code,
        corridor: edge.corridor,
    }));
}

export function edgesBetween(pack, a, b) {
    return (indexOf(pack).adjacency.get(a) ?? []).filter(edge =>
        (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
}
