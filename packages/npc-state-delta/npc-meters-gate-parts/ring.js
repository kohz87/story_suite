// The recent-approach ring: its size, the problems a stored ring can have, and cleaning a stored ring.
import { isInt, isReply } from './shared-values.js';
import { normalizeApproachKind } from './kinds.js';

export const RECENT_APPROACH_MAX = 6;

function approachEntryProblems(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['is not a record'];
    const errors = [];
    if (!isInt(entry.d)) errors.push('has no whole story day');
    if (!isReply(entry.r)) errors.push('has no reply');
    if (!normalizeApproachKind(entry.v)) errors.push('has no approach kind');
    return errors;
}

/** Problems with a stored ring ([] when fine). */
export function approachRingProblems(value) {
    if (!Array.isArray(value)) return ['is not a list'];
    const errors = [];
    if (value.length > RECENT_APPROACH_MAX) errors.push(`has more than ${RECENT_APPROACH_MAX} entries`);
    value.forEach((entry, index) => {
        for (const problem of approachEntryProblems(entry)) errors.push(`entry ${index + 1} ${problem}`);
    });
    return errors;
}

/** The usable entries of a stored ring, oldest first, at most RECENT_APPROACH_MAX (the newest are kept). */
export function normalizeApproachRing(raw) {
    if (!Array.isArray(raw)) return [];
    const usable = raw.filter(entry => approachEntryProblems(entry).length === 0).map(entry => ({ d: entry.d, r: entry.r, v: entry.v }));
    return usable.slice(-RECENT_APPROACH_MAX);
}
