// Evidence, lookup: laying pending entries over stored ones and indexing a list of proofs by id.

import { isObject } from '../constants.js';

// ---------- what is visible ----------

/** The entries with `pending` (this root's, not stored yet) laid over `stored`: a pending proof shadows a stored one of its id. */
export function merged(stored, pending) {
    if (!pending?.length) return stored;
    const ids = new Set(pending.map(entry => entry.proof.id));
    return [...stored.filter(entry => !ids.has(entry.proof.id)), ...pending];
}

// The proof of a list by id, and the ids given twice, kept for a frozen list (the store's, which is a new one whenever
// anything is written), so asking for an id does not look at every proof.
const indexes = new WeakMap();
export function indexOf(list) {
    const kept = indexes.get(list);
    if (kept) return kept;
    const byId = new Map();
    const twice = new Set();
    for (const { proof } of list) {
        if (!isObject(proof) || typeof proof.id !== 'string') continue;
        if (byId.has(proof.id)) twice.add(proof.id);
        else byId.set(proof.id, proof);
    }
    const index = { byId, twice };
    if (Object.isFrozen(list)) indexes.set(list, index);
    return index;
}
