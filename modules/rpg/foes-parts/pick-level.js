// Settles a foe's level: a given level, a rank's band or a seeded draw near the party, with one seeded stream per foe.
import { rng as seeded } from '../../../core/commands/rng.js';
import { FOE_LEVEL, levelOf } from './level-basics.js';

/**
 * A foe's level. `ask`: `{ level }` (used as given, held to 1..99), or `{ from, to }` (a rank's band: a seeded level inside it), or `{}` (a seeded level within ±2 of
 * `around`, the party's average, held to 1..99). `random` is a function giving [0, 1) (the reply's seeded generator).
 */
export function pickLevel(ask, around, random) {
    const given = levelOf(ask?.level);
    if (given !== null) return given;
    const from = levelOf(ask?.from), to = levelOf(ask?.to);
    if (from !== null && to !== null && from <= to) return from + Math.floor(random() * (to - from + 1));
    const centre = levelOf(around) ?? FOE_LEVEL.min;
    const level = centre - FOE_LEVEL.spread + Math.floor(random() * (2 * FOE_LEVEL.spread + 1));
    return Math.max(FOE_LEVEL.min, Math.min(FOE_LEVEL.max, level));
}

const SALT = 0x4C56B0F3;

/** The generator of the foe with place `at` (0-based) among the ones a reply opens or sets, from the reply's seed number `base` (a uint32): one stream each, so none moves another. */
export const foeRandom = (base, at) => seeded(((base >>> 0) ^ Math.imul(at + 1, 0x9E3779B1) ^ SALT) >>> 0);

/**
 * The foes of a plan's `open` list with their levels settled, from the reply's seed number `base`: an entry that has a `level` keeps it, one with a band
 * (`from`, `to`) draws inside it, one with neither draws near `around`. → [{ name, count, level }] (the same places).
 */
export const settleOpen = (open, around, base) => (open ?? []).map((entry, at) => ({
    name: entry.name, count: entry.count, level: pickLevel(entry, around, foeRandom(base, at)),
}));
