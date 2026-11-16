// Pack events, shared checks: what a record is and whether an event or decision id is well formed.

import { EVENT_LIMITS } from './shared-keys.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9._/:-]*$/;
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function checkId(id, what) {
    if (typeof id !== 'string' || !id.trim()) return `${what} needs an id.`;
    if (id.length > EVENT_LIMITS.id) return `${what} has an id longer than ${EVENT_LIMITS.id} characters.`;
    if (!ID.test(id)) return `${what} has the id "${id}", which may only hold letters, digits and . _ / : -`;
    return '';
}
