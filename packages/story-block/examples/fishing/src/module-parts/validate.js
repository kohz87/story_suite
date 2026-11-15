// The fishing record: its starting shape and the check that finds what is damaged in it (SPEC §2.5).
import { WATERS, RARITIES } from '../rules.js';
import { LOG_SIZE } from './constants.js';

const STATUSES = ['waiting', 'landed', 'lost'];
const QUALITY_IDS = ['poor', 'fair', 'fine', 'prime'];

export function initial() {
    return { sessions: {}, log: [] };
}

// ---- validation (SPEC §2.5) -------------------------------------------------------------------

const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const ID = prefix => new RegExp(`^${prefix}_[0-9a-z]{8}$`);

function spotErrors(spot, where) {
    if (!spot || typeof spot !== 'object') return [`${where} has no spot.`];
    const errors = [];
    if (!isStr(spot.name, 80) || !spot.name.trim()) errors.push(`${where} has no spot name.`);
    if (!WATERS.includes(spot.kind)) errors.push(`${where} is not at a river, a lake or the sea.`);
    return errors;
}

function catchErrors(c, where) {
    if (!c || typeof c !== 'object') return [`${where} has no fish.`];
    const errors = [];
    if (!isStr(c.name, 80) || !c.name) errors.push(`${where} has a fish with no name.`);
    if (!RARITIES.includes(c.rarity)) errors.push(`${where} has an unknown rarity.`);
    if (!QUALITY_IDS.includes(c.quality)) errors.push(`${where} has an unknown quality.`);
    if (!isInt(c.grams, 1)) errors.push(`${where} has a weight that is not a whole number of grams.`);
    if (!isInt(c.value, 0)) errors.push(`${where} has a value that is not a whole number.`);
    return errors;
}

export function validate(slice) {
    const errors = [];
    if (!slice || typeof slice !== 'object' || !slice.sessions || typeof slice.sessions !== 'object'
        || !Array.isArray(slice.log)) return ['The fishing record is damaged.'];
    let waiting = 0;
    for (const [id, s] of Object.entries(slice.sessions)) {
        const where = `Fishing session ${id}`;
        if (!ID('fs').test(id) || s?.id !== id) errors.push(`${where} has a bad id.`);
        errors.push(...spotErrors(s?.spot, where));
        if (s.bait !== null && !isStr(s.bait, 40)) errors.push(`${where} has a bad bait.`);
        if (s.startedRev !== null && !isInt(s.startedRev)) errors.push(`${where} has a bad start.`);
        if (!STATUSES.includes(s.status)) errors.push(`${where} has an unknown status.`);
        if (!isInt(s.n, 1)) errors.push(`${where} has no order.`);
        if (!s.bite || !isInt(s.bite.bite, 1) || !isInt(s.bite.window, 1)) errors.push(`${where} has a bad bite.`);
        errors.push(...catchErrors(s.catch, where));
        if (s.status === 'waiting') waiting += 1;
    }
    if (waiting > 1) errors.push('Only one fishing line can be in the water at a time.');
    if (slice.log.length > LOG_SIZE) errors.push(`The fishing log keeps at most ${LOG_SIZE} catches.`);
    for (const entry of slice.log) {
        const where = `Catch ${entry?.id}`;
        if (!ID('fc').test(entry?.id ?? '')) errors.push(`${where} has a bad id.`);
        errors.push(...catchErrors(entry, where), ...spotErrors(entry?.spot, where));
        if (typeof entry.released !== 'boolean') errors.push(`${where} does not say whether it was released.`);
    }
    return errors;
}

// ---- helpers for handlers -----------------------------------------------------------------------

// An id for a record made by this receipt: the receipt's own random part under our prefix, so it is
