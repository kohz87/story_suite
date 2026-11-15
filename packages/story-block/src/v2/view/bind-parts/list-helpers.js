// List helpers: length, case-blind containment and sums of a bound list, record or text.

import { valueAtKeys } from './path-read.js';

/** Items in a list, keys in a record, characters in a string; 0 otherwise. */
export function len(value) {
    if (typeof value === 'string' || Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
}

/**
 * contains(a, b): does text `a` hold text `b`, ignoring case (a filter box: `contains(name, draft.find)`)?
 * An empty or missing `b` is held by everything; a list holds `b` when one of its items does.
 */
export function contains(a, b) {
    const needle = typeof b === 'string' || typeof b === 'number' ? String(b).trim().toLocaleLowerCase() : '';
    if (!needle) return true;
    if (Array.isArray(a)) return a.some(item => contains(item, needle));
    if (typeof a !== 'string' && typeof a !== 'number') return false;
    return String(a).toLocaleLowerCase().includes(needle);
}

/**
 * sum(list, field?): the numbers in a list or the values of a record added up (a points-buy total:
 * `sum(draft.points)`); with `field`, each item's field (`sum(q.rows, 'base')`, or a dotted path
 * `sum(state.party.actors, 'hp.cur')`). Anything that is not a finite number counts as 0. Own
 * properties only: a field naming `__proto__`, `constructor` or `prototype` reads nothing.
 */
export function sum(list, field) {
    const items = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.values(list) : [];
    const keys = typeof field === 'string' && field !== '' ? field.split('.') : null;
    if (field !== undefined && field !== null && !keys) return 0;
    let total = 0;
    for (const item of items) {
        const value = keys ? valueAtKeys(item, keys) : item;
        if (typeof value === 'number' && Number.isFinite(value)) total += value;
    }
    // 0.1 + 0.2 reads as 0.3; whole numbers are already exact.
    return Number.isInteger(total) ? total : Math.round(total * 1e9) / 1e9;
}
