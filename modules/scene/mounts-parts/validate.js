// Checks the scene's mounts record (the §2.5 validator).

import { isPlainObject } from '../domains/common.js';
import { trimText } from '../names.js';
import { nameKey } from './shared-keys.js';
import { MAX_ROWS, MAX_COUNT, MAX_PACE, MAX_CARRY } from './caps-count.js';
import { MAX_NAME, MAX_KIND, MAX_CONDITION, MAX_WHERE } from './caps-text.js';

/** §2.5 validator for the scene's mounts (called with the scene slice): [] when fine, else plain sentences. */
export function validateMounts(slice) {
    const mounts = slice?.mounts;
    if (mounts === undefined) return [];
    if (!isPlainObject(mounts)) return ['The mounts are not a record.'];
    const errors = [];
    const keys = Object.keys(mounts);
    if (keys.length > MAX_ROWS) errors.push(`At most ${MAX_ROWS} mounts can be kept.`);
    const seen = new Set();
    for (const key of keys) {
        const row = mounts[key];
        if (!isPlainObject(row)) {
            errors.push('A mount is not a record.');
            continue;
        }
        if (typeof row.name !== 'string' || !row.name.trim()) errors.push('A mount has no name.');
        else {
            if (Array.from(row.name).length > MAX_NAME) errors.push(`The mount "${trimText(row.name, 30)}" has a name longer than ${MAX_NAME} characters.`);
            if (seen.has(nameKey(row.name))) errors.push(`${row.name} is listed as a mount twice.`);
            seen.add(nameKey(row.name));
        }
        const label = typeof row.name === 'string' && row.name.trim() ? trimText(row.name, 30) : 'A mount';
        for (const [field, max] of [['kind', MAX_KIND], ['condition', MAX_CONDITION], ['where', MAX_WHERE]]) {
            if (typeof row[field] !== 'string') errors.push(`${label}'s ${field} is not text.`);
            else if (Array.from(row[field]).length > max) errors.push(`${label}'s ${field} is longer than ${max} characters.`);
        }
        if (!Number.isSafeInteger(row.count) || row.count < 1 || row.count > MAX_COUNT) errors.push(`${label}'s count is not a whole number from 1 to ${MAX_COUNT}.`);
        if (!Number.isSafeInteger(row.pace) || row.pace < 1 || row.pace > MAX_PACE) errors.push(`${label}'s pace is not a whole number from 1 to ${MAX_PACE} km a day.`);
        if (row.carry !== undefined && (!Number.isSafeInteger(row.carry) || row.carry < 1 || row.carry > MAX_CARRY)) errors.push(`${label}'s carry is not a whole number from 1 to ${MAX_CARRY}.`);
    }
    return errors;
}
