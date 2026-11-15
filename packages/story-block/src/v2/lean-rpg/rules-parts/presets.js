// The difficulty words and the Standard formula's presets (only the foe's base moves).
import { FORMULA, LIMITS } from '../names.js';
import { STANDARD_NUMBERS } from '../formula.js';
import { STANDARD_RULE_KEYS } from './numbers.js';

/** The choices the reader sees, in order. */
export const DIFFICULTIES = Object.freeze(['gentle', 'standard', 'harsh', 'custom']);

const standardPreset = foeBase => {
    const all = { formula: 'standard', ...STANDARD_NUMBERS, foeBase, classWeight: FORMULA.classWeight, costMargin: FORMULA.costMargin, decisiveMargin: LIMITS.decisiveMargin, roundCap: LIMITS.roundCapDefault };
    return Object.freeze(Object.fromEntries(STANDARD_RULE_KEYS.map(key => [key, all[key]])));
};

/**
 * Standard's three presets: only the foe's base moves (simulation, scripts/sim-standard.mjs: a focused build against a foe of its own
 * Soul Class succeeds about 65 to 80 times in a hundred across Soul Classes I to IX at Standard, a spread build 45 to 60).
 */
export const STANDARD_PRESETS = Object.freeze({
    gentle: standardPreset(2),
    standard: standardPreset(4),
    harsh: standardPreset(6),
});
export const STANDARD_FORMULA = STANDARD_PRESETS.standard;
/** The default numbers of a roll (the Standard preset). */
export const STANDARD = STANDARD_FORMULA;
