// Bounded value coercion for ledger text, turn numbers and source message ids.
import * as mechanics from '../core-mechanics.js';

export function profileDevelopmentText(field, value, maxChars = null) {
    const limit = Math.max(1, Number(maxChars) || mechanics.DURABLE_PROFILE_LIMITS[field] || mechanics.DURABLE_PROFILE_LIMITS.evidence);
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function profileDevelopmentTurn(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

export function profileDevelopmentSourceMessageId(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
}
