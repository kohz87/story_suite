// Any value as a full set of Standard numbers (each held to its range), and the numbers of a roll recorded before numbers were kept.
import { LIMITS } from '../names.js';
import { divisorOf } from './levels.js';
import { STANDARD_RANGES, STANDARD_RULE_KEYS } from './numbers.js';
import { STANDARD_FORMULA } from './presets.js';

/**
 * The numbers of a roll recorded before the numbers were kept (a payload with no `rules`): the Standard difficulty with the cap of 5 exchanges it had. Replay reads those with this, never with today's presets.
 */
export const EARLIER_RULES = Object.freeze({ ...STANDARD_FORMULA, roundCap: LIMITS.roundCap });

/** Whether numbers are the Standard formula's. */
export const isStandard = rules => rules?.formula === 'standard';

const whole = (value, range, fallback) => (Number.isSafeInteger(value) && value >= range.min && value <= range.max ? value : fallback);

/**
 * Any value as a full set of numbers: Standard's, each one a whole number inside its range (a value with no `formula`, which only an old record
 * can be, is read as Standard too). Always the same keys in the same order (so the same numbers always hash the same), whatever was given, including nothing.
 */
export const normalizeRules = value => normalizeStandard(value);

/**
 * Any value as Standard's full set of numbers: each one a whole number inside its range, else the Standard preset's; the creation numbers
 * must also agree (lowest ≤ start ≤ highest at creation ≤ the stat maximum), else all four are the preset's. Always the same keys in the same order.
 */
export function normalizeStandard(value) {
    const given = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = Object.fromEntries(STANDARD_RULE_KEYS.map(key => [key, key === 'formula' ? 'standard' : whole(given[key], STANDARD_RANGES[key], STANDARD_FORMULA[key])]));
    if (!(out.createMin <= out.startStat && out.startStat <= out.createMax && out.createMax <= out.statMax)) {
        for (const key of ['startStat', 'createMin', 'createMax', 'statMax']) out[key] = STANDARD_FORMULA[key];
    }
    if (divisorOf(given.levelDivisor)) out.levelDivisor = given.levelDivisor;
    return out;
}
