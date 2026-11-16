// Story Director v2, tracker part (initiative): checks `director.initiative` in the validator.

import { isInt, isRecord } from './shared-guards.js';

/** The validator's check of `director.initiative`: null or a one-entry slot. */
export function initiativeErrors(slice) {
    const stored = slice?.initiative;
    if (stored === undefined || stored === null) return [];
    const value = Array.isArray(stored) && stored.length === 1 ? stored[0] : null;
    if (!isRecord(value) || !isInt(value.round) || !(value.at === null || isInt(value.at)) || !(value.key === null || typeof value.key === 'string')
        || !Array.isArray(value.recent) || value.recent.some(entry => !isRecord(entry) || typeof entry.key !== 'string' || !isInt(entry.round))) {
        return ['director.initiative must be null or [{ at, round, key, name, recent }].'];
    }
    return [];
}
