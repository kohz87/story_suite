// Story Director v2, names: the initial names slice and its validator.

import { MAX_NAME, } from './limits.js';
import { PROFILE_FIELDS, MAX_FIELD, MAX_MINOR } from './profile-limits.js';
import { nameKey } from './keys.js';
import { MAX_SEEN, MAX_TAKEN, isInt } from './slice-limits.js';
import { identityKey, identityOk } from './slice-keys.js';
import { isRecord } from './host-read.js';

export const initialNames = () => ({ people: {}, seen: {}, taken: {} });

/** The validator: [] or sentences. */
export function validateNames(slice) {
    if (!isRecord(slice) || !['people', 'seen', 'taken'].every(table => isRecord(slice[table]))) return ['names is not { people, seen, taken }.'];
    const errors = [];
    const nameOk = (key, entry) => isRecord(entry) && typeof entry.name === 'string' && Array.from(entry.name).length <= MAX_NAME && nameKey(entry.name) === key && isInt(entry.rev);
    for (const [key, entry] of Object.entries(slice.people)) {
        const profile = entry?.profile;
        if (!nameOk(key, entry) || !isInt(entry.first) || (profile !== null && !(isRecord(profile) && PROFILE_FIELDS.every(field => typeof profile[field] === 'string' && Array.from(profile[field]).length <= MAX_FIELD)))) errors.push(`names.people.${key} is not { name, first, profile, rev }.`);
    }
    for (const [key, entry] of Object.entries(slice.seen)) if (!(entry?.source === undefined ? nameOk(key, entry) : identityOk(entry) && identityKey(entry) === key && isInt(entry.rev))) errors.push(`names.seen.${key} is not a name or identity.`);
    for (const [key, entry] of Object.entries(slice.taken)) if (!nameOk(key, entry) || typeof entry.told !== 'boolean') errors.push(`names.taken.${key} is not { name, rev, told }.`);
    if (Object.keys(slice.people).length > MAX_MINOR || Object.keys(slice.seen).length > MAX_SEEN || Object.keys(slice.taken).length > MAX_TAKEN) errors.push('names holds more entries than it may.');
    for (const key of Object.keys(slice)) if (!['people', 'seen', 'taken'].includes(key)) errors.push(`names has an unknown field "${key}".`);
    return errors.slice(0, 10);
}
