// Reading a field table property into an ordered key list or an ordered [key, value] list.

import { FIELDS } from './table.js';

// The fields with `property`, in that list's order.
export function listOf(property) {
    return Object.freeze(Object.entries(FIELDS)
        .filter(([, field]) => Number.isInteger(field[property]))
        .sort((a, b) => a[1][property] - b[1][property])
        .map(([key]) => key));
}
// The [position, value] entries of `property`, in order.
export function pairsOf(property) {
    return Object.entries(FIELDS)
        .filter(([, field]) => Array.isArray(field[property]))
        .sort((a, b) => a[1][property][0] - b[1][property][0])
        .map(([key, field]) => [key, field[property][1]]);
}
