// The level numbers (the RPG's: 100 xp a level, 99 at the most, xp held to 9999) and the XP rate: how an xp gain is scaled. Adapted from modules/rpg/names-parts/level.js and modules/rpg/levels-parts/xp-rate.js, scale-xp.js (keep in step when those change).

/** The level numbers. */
export const LEVEL = Object.freeze({ max: 99, xpPerLevel: 100, xpMax: 9999 });
/** The XP rate setting's bounds, in per cent: 50 to 300 in steps of 25, 100 unset. */
export const XP_RATE = Object.freeze({ min: 50, max: 300, step: 25, default: 100 });

/** The xp a character holds on reaching `level`. */
export const xpOfLevel = level => (Math.min(LEVEL.max, Math.max(1, Math.trunc(Number.isFinite(level) ? level : 1))) - 1) * LEVEL.xpPerLevel;

/** `gain` at `rate` per cent: floor(gain × rate / 100), at least 1 when the gain was 1 or more; a gain below 1 is 0. A rate off its steps is 100. */
export function scaleXp(gain, rate = XP_RATE.default) {
    if (!Number.isSafeInteger(gain) || gain < 1) return Number.isSafeInteger(gain) ? gain : 0;
    const ok = Number.isInteger(rate) && rate >= XP_RATE.min && rate <= XP_RATE.max && (rate - XP_RATE.min) % XP_RATE.step === 0;
    return Math.max(1, Math.floor(gain * (ok ? rate : XP_RATE.default) / 100));
}
