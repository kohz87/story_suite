// Checking an identity as stored.

import { NP_ID, emptyIdentity, isRecord } from './shared-basics.js';

/** An identity as stored, checked: a copy, or an empty one for anything that is not whole. */
export function cleanIdentity(raw) {
    const out = emptyIdentity();
    if (!isRecord(raw) || !isRecord(raw.map)) return out;
    for (const [id, entry] of Object.entries(raw.map)) {
        if (!NP_ID.test(id) || !isRecord(entry) || typeof entry.nativeKey !== 'string' || !entry.nativeKey) continue;
        out.map[id] = { nativeKey: entry.nativeKey, archived: entry.archived === true, since: Number.isSafeInteger(entry.since) ? entry.since : 0 };
    }
    for (const [id, entry] of Object.entries(out.map)) if (!entry.archived) out.byKey[entry.nativeKey] = id;
    return out;
}
