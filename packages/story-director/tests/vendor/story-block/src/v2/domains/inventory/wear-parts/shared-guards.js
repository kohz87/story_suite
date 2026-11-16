// Guards shared by the wear and repair handlers: only a module may call, and amounts are clamped.

import { COND_MAX } from '../state.js';

function readParty(ctx) {
    try {
        return ctx.read('party');
    } catch {
        return null;
    }
}

// Only another module's rules wear or mend a piece (a fight, a fall, a smith's work): `ctx.caller` must
// be set, whatever the cause. Amounts are clamped into 0…100, so a module's call never fails on a
// number that is merely too big (its whole action would fail with it).
export function moduleOnly(ctx, what) {
    if (!ctx.caller) ctx.fail('REFUSED', `${what} comes from another module's rules, not from a button or a change line.`);
}

export function amountArg(ctx, value, fallback, what) {
    const n = value === undefined || value === null ? fallback : value;
    if (!Number.isSafeInteger(n) || n < 0) ctx.fail('INVALID', `The ${what} must be a whole number of at least 0.`);
    return Math.min(COND_MAX, n);
}
