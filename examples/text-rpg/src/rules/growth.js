// Practice, experience awards and the experience needed for each level.
import { LEVEL } from './levels.js';

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rollBand(value) {
    const band = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return ['great', 'success', 'cost', 'failure', 'bad'].includes(band) ? band : null;
}

function difficultyValue(value) {
    return Math.min(4, Math.max(0, Math.trunc(finite(value, 0))));
}

const THREAT_MULTIPLIERS = Object.freeze([0, 0.5, 1, 1.5, 2, 2]);

/** The practice points from one check: easy checks teach nothing; a failure 3, a success or a success at a cost 5, a success at hard or harder 10. */
export function practiceGain(band, difficultyIndex) {
    const key = rollBand(band);
    if (!key) return 0;
    const difficulty = difficultyValue(difficultyIndex);
    if (difficulty === 0) return 0;
    if (key === 'failure' || key === 'bad') return 3;
    return difficulty >= 2 && key !== 'cost' ? 10 : 5;
}

/** The fixed experience paid for each size of an overcome danger. */
export const XP_SIZES = Object.freeze({ trivial: 0, minor: 5, real: 20, major: 60, great: 150 });

/** Experience for a stated size, cut to what the reply's hardest check supports and scaled by threat, times the foes overcome (rounded once, after the count). */
export function xpFor(size, threat, hardestIndex, foes = 1) {
    const key = typeof size === 'string' ? size.trim().toLowerCase() : '';
    if (!Object.hasOwn(XP_SIZES, key)) return 0;
    if (hardestIndex === null || hardestIndex === undefined) return 0;
    if (typeof hardestIndex !== 'number' || !Number.isFinite(hardestIndex)) return 0;

    const hardest = Math.min(4, Math.max(0, Math.trunc(hardestIndex)));
    const threatLevel = Math.min(5, Math.max(0, Math.trunc(finite(threat, 0))));
    let paidSize = key;
    if (paidSize === 'great' && hardest < 3) paidSize = 'major';
    if (paidSize === 'major' && hardest < 2) paidSize = 'real';
    return Math.round(XP_SIZES[paidSize] * THREAT_MULTIPLIERS[threatLevel] * foes);
}

/** The level reached at a total experience (100 xp a level, as the RPG's), and the total needed for the next level (null at 99). */
export function levelFor(xp) {
    const total = Math.min(LEVEL.xpMax, Math.max(0, finite(xp, 0)));
    const level = Math.min(LEVEL.max, 1 + Math.floor(total / LEVEL.xpPerLevel));
    return { level, next: level < LEVEL.max ? level * LEVEL.xpPerLevel : null };
}
