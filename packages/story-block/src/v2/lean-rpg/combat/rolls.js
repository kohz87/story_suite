// Combat Rules v1 rolls: the player's bonus for each kind of roll, a foe's one roll bonus, the half-up mastery term and
// the outcome of either side's d20. Ties go to the player; a player's natural 1 misses and either side's natural 20 is decisive.

import { foeStats } from './foes.js';
import { V1 } from './numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));
const stat = (stats, key) => clamp(
    Number.isFinite(Number(stats?.[key])) && stats[key] !== null && stats[key] !== '' ? stats[key] : V1.stat.start,
    V1.stat.min, V1.stat.max,
);
const levelOf = level => clamp(level, V1.level.min, V1.level.max);
const stanceOf = stance => (typeof stance === 'string' ? stance.toLowerCase() : null);
const total = (die, bonus) => Math.floor(Number(die)) + Math.floor(Number(bonus));

/** Mastery adds in full to damage or healing and half, rounded up, to a roll. */
export const masteryTerm = mastery => Math.ceil(Math.max(0, Number.isFinite(Number(mastery)) ? Number(mastery) : 0) / V1.roll.masteryDiv);

/**
 * A player's bonus for one kind of roll: physical (DEX), magic (WIS), evasion (AGI), tempo (AGI), order (AGI) or
 * flee (AGI). Evasion and tempo add half mastery while their stance is on; level÷4 is added to all six.
 */
export function playerRoll(kind, stats, level, { mastery = 0, stance = null } = {}) {
    const lv = levelOf(level), half = masteryTerm(mastery), on = stanceOf(stance), r = V1.roll;
    const base = {
        physical: () => Math.floor(stat(stats, 'dex') / r.physicalDiv) + Math.floor(lv / r.levelDiv),
        magic: () => Math.floor(stat(stats, 'wis') / r.magicDiv) + Math.floor(lv / r.levelDiv),
        evasion: () => Math.floor(stat(stats, 'agi') / r.evasionDiv) + Math.floor(lv / r.levelDiv) + (on === 'evasion' ? half : 0),
        tempo: () => Math.floor(stat(stats, 'agi') / r.tempoDiv) + Math.floor(lv / r.levelDiv) + (on === 'movement' ? half : 0),
        order: () => Math.floor(stat(stats, 'agi') / r.orderDiv) + Math.floor(lv / r.levelDiv),
        flee: () => Math.floor(stat(stats, 'agi') / r.fleeDiv) + Math.floor(lv / r.levelDiv),
    };
    if (!Object.hasOwn(base, kind)) throw new TypeError(`Unknown player roll: ${kind}`);
    return base[kind]();
}

/**
 * A foe's one attack / defence / tempo roll bonus (6 + level÷3 + tier). `kind: 'order'` gives its initiative bonus
 * instead (level÷3 + tier): the base 6 belongs to every foe roll except the opening one.
 */
export function foeRoll(foe, kind = 'attack') {
    const full = Number.isFinite(Number(foe)) && typeof foe !== 'object' ? Math.floor(Number(foe))
        : Number.isFinite(Number(foe?.roll)) ? Math.floor(Number(foe.roll)) : foeStats(foe).roll;
    return kind === 'order' ? full - V1.foe.rollBase : full;
}

/**
 * The outcome of a d20 roll. `side` is 'player' (the default), 'foe' or 'flee'. A player's natural 1 always misses; a
 * natural 20 or a lead of the decisive margin is decisive. A foe's tie with the player's evasion is evaded, and a flee
 * (where a tie goes to the player) returns 'success' or 'fail'.
 */
export function rollOutcome(die, bonus, against, side = 'player') {
    const nat = Math.floor(Number(die)), mine = total(nat, bonus), theirs = Math.floor(Number(against));
    if (side === 'flee') return mine >= theirs ? 'success' : 'fail';
    if (side === 'player' && nat === V1.roll.naturalMiss) return 'miss';
    if (side === 'foe') {
        if (mine <= theirs) return 'evaded';
    } else if (mine < theirs) return 'miss';
    return mine - theirs >= V1.decisiveMargin || nat === V1.die ? 'decisive' : 'hit';
}
