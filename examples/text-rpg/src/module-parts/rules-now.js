// The two numbers the Text RPG Rules page sets for levels, the level cap and the XP rate: read when a reply's dice step is made, recorded in that step's receipt (so a Re-read or a replay uses the reply's own, never today's), read back by `+ xp`.
import { LEVEL, XP_RATE } from '../rules/levels.js';
import { ownSettings } from './settings.js';

const CAP_MAX = LEVEL.max;
const whole = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;

/** `{ cap, rate }` from a recorded value (anything off its bounds is the default: cap 99, rate 100). */
export function readRules(value) {
    const cap = whole(value?.cap, 1, CAP_MAX) ? value.cap : CAP_MAX;
    const rate = whole(value?.rate, XP_RATE.min, XP_RATE.max) && (value.rate - XP_RATE.min) % XP_RATE.step === 0 ? value.rate : XP_RATE.default;
    return { cap, rate };
}

/** The rules the settings say now: `source` is anything with `settings(id)` (the sdk, a hook's view). */
export function rulesOf(source) {
    const values = ownSettings(source);
    return readRules({ cap: Number(values.levelCap), rate: Number(values.xpRate) });
}

/** The compact form kept in a receipt: `{ cap, rate }` when either is not the default, else null (a record without it is the default). */
export function recordable(rules) {
    const now = readRules(rules);
    return now.cap === CAP_MAX && now.rate === XP_RATE.default ? null : now;
}

/** The most xp a character holds under a level cap: the end of that level (the game's top, 9999, at 99). */
export const xpCeiling = cap => (readRules({ cap }).cap >= CAP_MAX ? LEVEL.xpMax : readRules({ cap }).cap * LEVEL.xpPerLevel - 1);
