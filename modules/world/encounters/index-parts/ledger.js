// The encounters' record in the director slice (`director.encounters`, a slot `[{ results, seen, bound }]`): the last results, how often
// each recurring backdrop person was seen, and the backdrop people the story named (promoted to an NPC State dossier). Pure.

import { LIMITS } from './limits.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = value => Number.isSafeInteger(value);

/** The ledger as `{ results, seen, bound }` (empty when there is none). */
export function ledgerOf(director) {
    const value = Array.isArray(director?.encounters) && director.encounters.length === 1 ? director.encounters[0] : null;
    return { results: Array.isArray(value?.results) ? value.results : [], seen: isRecord(value?.seen) ? value.seen : {}, bound: isRecord(value?.bound) ? value.bound : {} };
}

/** The ledger with `entry` as the result for reply `entry.at` (one per reply; a recurring backdrop counts one more sighting, once per reply). */
export function withResult(ledger, entry) {
    const results = [...ledger.results.filter(item => item.at !== entry.at), entry].slice(-LIMITS.results);
    let seen = ledger.seen;
    if (entry.kind === 'backdrop' && entry.recurring && entry.ref && seen[entry.ref]?.at !== entry.at) {
        const kept = Object.entries(seen).filter(([ref]) => ref !== entry.ref).sort(([, a], [, b]) => a.at - b.at).slice(-(LIMITS.seen - 1));
        seen = Object.fromEntries([...kept, [entry.ref, { n: (seen[entry.ref]?.n ?? 0) + 1, at: entry.at }]]);
    }
    return { ...ledger, results, seen };
}

/** The ledger with backdrop `ref` bound to the dossier `{ key, name }` from reply `at` (the story named them). */
export const withBinding = (ledger, { ref, key, name, at }) => ({ ...ledger, bound: { ...ledger.bound, [ref]: { key, name, at } } });

/** `director.encounters` problems for the director validator: [] when it is absent or well formed. */
export function ledgerErrors(slice) {
    const value = slice?.encounters;
    if (value === undefined || value === null) return [];
    const one = Array.isArray(value) && value.length === 1 && isRecord(value[0]) ? value[0] : null;
    const ok = one && Array.isArray(one.results) && one.results.length <= LIMITS.results && one.results.every(item => isRecord(item) && isInt(item.at) && typeof item.kind === 'string')
        && isRecord(one.seen) && Object.keys(one.seen).length <= LIMITS.seen && Object.values(one.seen).every(item => isRecord(item) && isInt(item.n) && isInt(item.at))
        && isRecord(one.bound) && Object.values(one.bound).every(item => isRecord(item) && typeof item.key === 'string' && typeof item.name === 'string' && isInt(item.at));
    return ok ? [] : ['director.encounters must be null or [{ results, seen, bound }].'];
}
