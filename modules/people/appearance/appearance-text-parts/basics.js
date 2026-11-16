/* Bounded text cleaning, boolean reading, own-property test and the length-limited appearance text. A part of appearance-text.js (same owner, moved without change). */
import { DURABLE_PROFILE_LIMITS } from '../../core/core-relationship.js';

export function clean(value, max = 1800) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function truthy(value) {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}
export function appearanceText(value, max = DURABLE_PROFILE_LIMITS?.appearance || 800) { return clean(value, max); }
export function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
