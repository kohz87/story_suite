// Formatting hops, route paths, exits, and road names.

import { num } from '../util.js';
import { exitsFrom } from '../pack.js';

export function hopText(hop) {
    return `${hop.from} → ${hop.to} ${num(hop.km)} ${hop.code}`;
}

export function routeText(route) {
    return [route.from, ...route.hops.map(hop => `${hop.to} ${num(hop.km)} ${hop.code}`)].join(' → ');
}

export function exitsText(pack, place) {
    const exits = exitsFrom(pack, place);
    if (!exits.length) return `${place} has no exits.`;
    return `Exits from ${place}: ${exits.map(exit => `${exit.to} ${num(exit.km)} ${exit.code}`).join(', ')}.`;
}

export function roadName(edge) {
    if (!edge) return 'the road';
    return edge.corridor ? `the ${edge.corridor} (${edge.code})` : `the ${edge.code} road`;
}
