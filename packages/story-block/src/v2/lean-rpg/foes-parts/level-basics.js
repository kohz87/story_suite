// The levels a foe may have: the limits (FOE_LEVEL), a value read as a level, and a Soul Class turned into its level.
import { levelOfClass as mapClass } from '../formula.js';

/** The level a Soul Class (1-9) stands for (formula.js levelOfClass: class n -> 10n - 5), or null where no class is given. */
export const levelOfClass = soulClass => (Number.isInteger(soulClass) && soulClass >= 1 && soulClass <= 9 ? mapClass(soulClass) : null);

/** The levels a foe may have, how far from the party's average an unplanned one lands, the roll term's default divisor, and the Health block rule. */
export const FOE_LEVEL = Object.freeze({ min: 1, max: 99, spread: 2, divisor: 5, healthBase: 4, healthStep: 30, hardBase: 12, hardMax: 15, hardDivisor: 4, band: 20, oldBand: 10 });

const whole = value => (typeof value === 'number' && Number.isInteger(value) ? value : typeof value === 'string' && /^\s*-?\d+\s*$/u.test(value) ? Number(value) : null);

/** `value` as a level: a whole number held to 1..99, else null. */
export const levelOf = value => {
    const n = whole(value);
    return n === null ? null : Math.max(FOE_LEVEL.min, Math.min(FOE_LEVEL.max, n));
};
