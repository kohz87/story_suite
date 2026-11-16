// Levels: the XP-rate setting and reading a rate.

// ---- the XP rate (Levels release) ------------------------------------------------------------------------------------------------
// The setting `rpgXpRate` (Story Block's own bucket, Settings → RPG; the row is the settings view's): every XP gain to a character, the fight XP given by code
// and the narrator's XP lines, is multiplied by it. A percent from 50 to 300 in steps of 25, 100 unset. The gain is rounded down and is at least 1 when the
// raw gain was 1 or more (0 stays 0). The rate in force is recorded with the reply that used it (the fight step's payload `rate`, the XP line's decision `xpRate`),
// only when it is not 100, so a later change of the setting never moves a past reply and a record without it is 100.
export const XP_RATE_SETTING = 'rpgXpRate';
export const XP_RATE = Object.freeze({ min: 50, max: 300, step: 25, default: 100 });

/** `value` as a rate: a whole number from 50 to 300 on a step of 25, else null. */
export const xpRateOf = value => (Number.isInteger(value) && value >= XP_RATE.min && value <= XP_RATE.max && (value - XP_RATE.min) % XP_RATE.step === 0 ? value : null);

/** The rate the settings say (100 when unset or not a rate; a number off the step is brought to the nearest step inside 50..300). */
export function xpRateFrom(values) {
    const raw = values?.[XP_RATE_SETTING];
    if (xpRateOf(raw) !== null) return raw;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return XP_RATE.default;
    const stepped = XP_RATE.min + Math.round((Math.max(XP_RATE.min, Math.min(XP_RATE.max, raw)) - XP_RATE.min) / XP_RATE.step) * XP_RATE.step;
    return xpRateOf(stepped) ?? XP_RATE.default;
}
