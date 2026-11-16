// Reads what a roll payload carries: the turn order, the rules, the stale slots and the recorded foe levels.
import { FOE_SLOTS } from '../names.js';
import { EARLIER_RULES, normalizeRules } from '../rules.js';
import { isObject } from './shared-plain.js';

// The turn order a Standard roll is given (resolve.js carries it forward in the payload): a short list of { id, name, total, die?, bonus?, agi,
// party }, or null when there is none or it is damaged (the fight then starts here).
const ORDER_ID = /^(?:c:.{1,80}|f:\d{1,3})$/u;
export function orderOf(value) {
    if (!Array.isArray(value) || !value.length || value.length > 24) return null;
    const ok = value.every(entry => isObject(entry) && ORDER_ID.test(entry.id) && typeof entry.name === 'string' && entry.name.length <= 80
        && Number.isSafeInteger(entry.total) && Number.isSafeInteger(entry.agi) && typeof entry.party === 'boolean'
        && (entry.die === undefined || entry.die === null || Number.isSafeInteger(entry.die)) && (entry.bonus === undefined || entry.bonus === null || Number.isSafeInteger(entry.bonus))
        && (entry.left === undefined || (Number.isSafeInteger(entry.left) && entry.left >= 0)));
    return ok && new Set(value.map(entry => entry.id)).size === value.length ? value : null;
}

export const levelsValid = levels => Array.isArray(levels) && levels.length <= FOE_SLOTS && levels.every(level => Number.isInteger(level) && level >= 1 && level <= 99);

// The numbers a payload rolls with: the ones it carries, or, for a roll recorded before the numbers were kept, those it was made with (the cap of 5 included).
export const rulesOfPayload = value => (value === undefined ? EARLIER_RULES : normalizeRules(value));

// The slots of stale groups a pre-check opening put down: a non-empty list of foe slots (1–6), else undefined.
export const staleOf = value => (Array.isArray(value) && value.length > 0 && value.length <= 6 && value.every(slot => Number.isInteger(slot) && slot >= 1 && slot <= 6) ? [...new Set(value)].sort((a, b) => a - b) : undefined);
