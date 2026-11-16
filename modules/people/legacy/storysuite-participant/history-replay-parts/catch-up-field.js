// Reading, shaping and copying the catch-up field that history replay persists.

import { HISTORY_REPLAY_CAP } from './limits.js';
import { isRecord } from './shared-basics.js';

export function declaredCap(value) {
    const number = typeof value === 'function' ? value() : value;
    if (!Number.isFinite(number) || number < 0) return HISTORY_REPLAY_CAP;
    return Math.floor(number);
}

export function fieldOf({ from, to, reason, attempt, skipped = false }) {
    return skipped
        ? { from, to, reason, attempt, skipped: true }
        : { from, to, reason, attempt };
}

export function fieldCopy(field) {
    return field ? { ...field } : null;
}

export function persistedOf(base) {
    const field = isRecord(base) ? base.catchUp : null;
    if (!isRecord(field)) return null;
    if (!Number.isInteger(field.from) || !Number.isInteger(field.to) || field.to < field.from) return null;
    return {
        from: field.from,
        to: field.to,
        reason: typeof field.reason === 'string' ? field.reason : '',
        attempt: Number.isInteger(field.attempt) && field.attempt > 0 ? field.attempt : 0,
        skipped: field.skipped === true,
    };
}
