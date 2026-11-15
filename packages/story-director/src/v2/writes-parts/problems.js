// Story Director v2, retry ledger: the problems of a ledger, for a domain validator.

import { WRITE_ID, WRITES_LIMIT, isRecord } from './shared-ledger.js';

/** The problems of a ledger (a domain validator's part): [] or sentences. */
export function ledgerProblems(ledger, where) {
    if (!isRecord(ledger)) return [`${where} is not an object.`];
    const errors = [];
    const keys = Object.keys(ledger);
    if (keys.length > WRITES_LIMIT) errors.push(`${where} holds more than ${WRITES_LIMIT} writes.`);
    for (const key of keys) {
        const held = ledger[key];
        if (!WRITE_ID.test(key) || !isRecord(held) || !/^[0-9a-f]{64}$/.test(held.fingerprint ?? '') || !isRecord(held.result)) errors.push(`${where}.${key} is not { fingerprint, result }.`);
    }
    return errors.slice(0, 5);
}
