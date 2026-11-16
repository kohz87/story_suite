// Story Suite v2: the reader's Glass strength: its range, clamping and the glass alphas.

import { DEFAULT_GLASS } from './defaults.js';

/** The reader's Glass strength (host setting `glassStrength`, a percentage): its range and default. */
export const GLASS_MIN = 30;
export const GLASS_MAX = 90;
export const clampStrength = value => {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return DEFAULT_GLASS;
    return Math.min(GLASS_MAX, Math.max(GLASS_MIN, Math.round(n)));
};
/**
 * The glass's alpha for a Glass strength (30–90%): the concept's own at 50%: dark 0.50 / strong 0.66, light
 * 0.55 / 0.72; a higher strength is denser (at most 0.98), a lower one clearer.
 */
export function glassAlphas(scheme, strength = DEFAULT_GLASS) {
    const s = clampStrength(strength) / 100;
    const light = scheme === 'light';
    const round = n => Math.round(Math.min(0.98, n) * 100) / 100;
    return { glass: round(s + (light ? 0.05 : 0)), strong: round(s + (light ? 0.22 : 0.16)) };
}
