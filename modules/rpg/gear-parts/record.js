// The gear mark a roll's payload carries and the check that a gear record is one this version reads.
import { STATS } from '../names.js';
import { GEAR_VERSION } from './shared-marks.js';
import { MEMBERS_MAX, OWN_MAX, ITEMS_MAX, NAME_MAX } from './shared-caps.js';
import { isObject } from './shared-helpers.js';

/**
 * The mark a roll's payload carries while gear is on: `{ v: 1 }` or `{ v: 1, lead: '<reader name>' }`, or undefined. `lead` is a stable fact about the roll (who the
 * shared bag `party` meant: the reader's name, used when no party module names the main character), not a gear record; the roll works its gear out itself (resolve.js).
 */
export function gearMarkOf(value) {
    if (!isObject(value) || value.v !== GEAR_VERSION) return undefined;
    const lead = typeof value.lead === 'string' ? value.lead.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
    return lead ? { v: GEAR_VERSION, lead } : { v: GEAR_VERSION };
}

/** Whether `gear` (from a payload, a record) is a record this version reads: damaged ones are not guessed at. */
export function gearValid(gear) {
    if (!isObject(gear) || gear.v !== GEAR_VERSION || !isObject(gear.who) || Object.keys(gear).some(key => !['v', 'who'].includes(key))) return false;
    const entries = Object.entries(gear.who);
    if (entries.length > MEMBERS_MAX) return false;
    const stats = value => isObject(value) && Object.entries(value).every(([stat, n]) => STATS.includes(stat) && Number.isSafeInteger(n) && n >= -30 && n <= 30);
    return entries.every(([key, entry]) => typeof key === 'string' && key.length > 0 && key.length <= NAME_MAX && isObject(entry)
        && Array.isArray(entry.own) && entry.own.length <= OWN_MAX && entry.own.every(owner => typeof owner === 'string' && owner.length > 0 && owner.length <= NAME_MAX)
        && (entry.add === undefined || stats(entry.add)) && (entry.enc === undefined || (Number.isSafeInteger(entry.enc) && entry.enc < 0 && entry.enc >= -10))
        && (entry.items === undefined || (Array.isArray(entry.items) && entry.items.length <= ITEMS_MAX && entry.items.every(item => isObject(item) && typeof item.name === 'string' && item.name.length <= NAME_MAX && stats(item.stats)))));
}

/** The gear a payload carries when it is one this version reads, else undefined (a roll made before, or a damaged record, is rolled without it). */
export const gearOf = value => (gearValid(value) ? value : undefined);
