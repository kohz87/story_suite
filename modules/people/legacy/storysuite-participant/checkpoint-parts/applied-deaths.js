// Checking the applied deaths as the checkpoint stores them.

import { isRecord } from './shared-records.js';

/** The applied deaths as stored: { eventId: { nativeKey, at } }, checked. */
export function cleanApplied(raw) {
    const out = {};
    if (!isRecord(raw)) return out;
    for (const [event, entry] of Object.entries(raw)) {
        if (event && isRecord(entry) && typeof entry.nativeKey === 'string' && entry.nativeKey) out[event] = { nativeKey: entry.nativeKey, at: Number.isSafeInteger(entry.at) ? entry.at : 0 };
    }
    return out;
}
