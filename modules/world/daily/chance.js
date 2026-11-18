// World events, the daily step: today's chance of an event and the seeded roll against it (spec v0.10 §3). Pure.
//   likely / possible   daily = 1 − (1 − P)^(1/days), then the odds modifiers: o = p/(1−p), o' = o × m, p' = o'/(1+o')
//   set-in-motion       1 − (1 − 1/d)^m, d = days left in the window including today (d = 1 → 1; m = 0 → 0 before the last day)
//   a daily chance of 0 is not rolled (recorded "blocked (×0)")

import { sha256 } from '../hash.js';

const DEFAULTS = Object.freeze({ likely: 0.7, possible: 0.15 });

/** The whole-window (or per-season) probability of a likely/possible event: its `chance` percent or the certainty default. */
export function wholeChance(def) {
    if (def.chance && Number.isFinite(def.chance.percent)) return Math.min(1, Math.max(0, def.chance.percent / 100));
    return DEFAULTS[def.certainty] ?? DEFAULTS.possible;
}

/**
 * Today's chance: `{ p, blocked }`. `days` is the window length (or the season length for a per-season chance), `left` the days
 * left in the window including today (set-in-motion only), `m` the product of today's matching modifiers.
 */
export function dailyChance(def, { days, left, m = 1 }) {
    if (def.certainty === 'set-in-motion') {
        if (left <= 1) return { p: 1, blocked: false };
        if (m === 0) return { p: 0, blocked: true };
        return { p: 1 - (1 - 1 / left) ** m, blocked: false };
    }
    if (m === 0) return { p: 0, blocked: true };
    const whole = wholeChance(def);
    const base = whole >= 1 ? 1 : 1 - (1 - whole) ** (1 / Math.max(1, days));
    if (base <= 0) return { p: 0, blocked: true };
    if (base >= 1 || m === 1) return { p: base, blocked: false };
    const odds = (base / (1 - base)) * m;
    return { p: Math.min(1, odds / (1 + odds)), blocked: false };
}

/** The seeded draw in [0, 1) for (campaign seed, day, key): the same inputs always give the same draw (swipes never re-roll). */
export function seededDraw(seed, day, key) {
    const hex = sha256(`${seed}|${day}|${key}`);
    return parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

/** Roll today's chance with `draw(day, key)` (seededDraw bound to the campaign seed): `{ rolled, hit, draw }`; a chance of 0 is not rolled. */
export function rollChance(draw, day, key, chance) {
    if (chance.blocked || chance.p <= 0) return { rolled: false, hit: false, draw: null };
    if (chance.p >= 1) return { rolled: true, hit: true, draw: null };
    const value = draw(day, key);
    return { rolled: true, hit: value < chance.p, draw: value };
}
