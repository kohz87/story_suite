// The reader's per-tier daily allowance: its defaults, its limit, and reading it from settings.
import { PACING_TIERS } from './shared-tiers.js';

export const DEFAULT_ALLOWANCE = Object.freeze({ ordinary: 3, meaningful: 1, major: 1, extreme: 1 });
export const ALLOWANCE_MAX = 99;

/**
 * The reader's allowance as { tier: whole number 0..99 | null }. null (a blank field) is no limit and is kept apart
 * from a missing key, which reads as the default.
 */
export function normalizeAllowance(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const tier of PACING_TIERS) {
        const value = source[tier];
        if (!Object.hasOwn(source, tier) || value === undefined) out[tier] = DEFAULT_ALLOWANCE[tier];
        else if (value === null || (typeof value === 'string' && !value.trim())) out[tier] = null;
        else {
            const number = Number(value);
            out[tier] = Number.isFinite(number) ? Math.max(0, Math.min(ALLOWANCE_MAX, Math.round(number))) : DEFAULT_ALLOWANCE[tier];
        }
    }
    return out;
}
