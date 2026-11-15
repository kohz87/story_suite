// Whether two sets of numbers are the same, and which preset a set is.
import { LEVEL } from '../names.js';
import { DIFFICULTIES, STANDARD_PRESETS } from './presets.js';
import { normalizeRules } from './normalize.js';

/** Whether two sets of numbers are the same numbers. */
export const sameRules = (a, b) => {
    const [x, y] = [normalizeRules(a), normalizeRules(b)];
    return Object.keys(x).every(key => x[key] === y[key]) && (x.levelDivisor ?? LEVEL.divisor) === (y.levelDivisor ?? LEVEL.divisor);
};

/** The preset these numbers are exactly, else 'custom'. */
export const presetOf = rules => DIFFICULTIES.slice(0, 3).find(name => sameRules(STANDARD_PRESETS[name], rules)) ?? 'custom';
