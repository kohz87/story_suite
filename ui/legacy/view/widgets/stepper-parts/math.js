// The step-grid maths of the stepper: its limits, budget, clamping and what is left to spend.

import { clamp, num } from '../dom.js';
import { EPSILON } from './shared-epsilon.js';

const tidy = value => Math.round(value * 1e6) / 1e6;

/**
 * The stepper's limits for a starting point: `{ lo, hi, step, cost }`. `hi` is the lower of `max` and
 * what the budget can buy from `value` (never below `value` itself, so a value already over budget is
 * kept, just not raised).
 */
export function stepperLimits({ value, min, max, step, budget, cost }) {
    const s = num(step, 1) > 0 ? num(step, 1) : 1;
    const c = num(cost, 1) >= 0 ? num(cost, 1) : 1;
    const lo = num(min, 0);
    let hi = max === null || max === undefined ? Infinity : Math.max(lo, num(max, Infinity));
    if (budget !== null && budget !== undefined && c > 0) {
        const steps = Math.floor(num(budget, 0) / c + EPSILON);
        hi = Math.min(hi, Math.max(value, value + steps * s));
    }
    return { lo, hi, step: s, cost: c };
}

/** The points left now: `budget` when given, else `pool − spent`, else null (no budget). */
export function stepperBudget({ budget = null, pool = null, spent = 0 } = {}) {
    if (budget !== null && budget !== undefined) return budget;
    if (pool === null || pool === undefined) return null;
    return tidy(num(pool, 0) - num(spent, 0));
}

/** A typed or stepped value snapped to the step grid from `lo` and clamped into [lo, hi]. */
export function stepperClamp(raw, { lo, hi, step }) {
    const value = num(raw, lo);
    const snapped = lo + Math.round((value - lo) / step) * step;
    return clamp(tidy(snapped), lo, hi);
}

/** Points left after moving from `base` to `value` (null without a budget). */
export function stepperRemaining(base, value, budget, { step, cost }) {
    if (budget === null || budget === undefined) return null;
    return tidy(num(budget, 0) - ((value - base) / step) * cost);
}
