// Story Director v2, retry ledger: fingerprints a command and looks up or records a write in a ledger.

import { hashJson } from '../hash.js';
import { WRITES_LIMIT, isRecord } from './shared-ledger.js';

/** The fingerprint of a command: the hash of its type and payload without `write`. */
export function fingerprintOf(type, payload) {
    const { write: _write, ...rest } = payload ?? {};
    return hashJson({ type, payload: rest });
}

/**
 * Looks a write up in a ledger: `{ result }` for a retry (same fingerprint), `{ conflict: true }` for the same write with another meaning,
 * null for a write not seen.
 */
export function retryOf(ledger, write, fingerprint) {
    if (!isRecord(ledger) || !Object.hasOwn(ledger, write)) return null;
    const held = ledger[write];
    return held.fingerprint === fingerprint ? { result: structuredClone(held.result) } : { conflict: true };
}

/** Records a write's result in a draft ledger, dropping the oldest past the limit. */
export function remember(ledger, write, fingerprint, result) {
    ledger[write] = { fingerprint, result: structuredClone(result) };
    const keys = Object.keys(ledger);
    for (const key of keys.slice(0, Math.max(0, keys.length - WRITES_LIMIT))) delete ledger[key];
}
