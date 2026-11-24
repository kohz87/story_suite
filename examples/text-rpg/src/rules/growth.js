// Practice and the experience needed for each level.
import { LEVEL } from './levels.js';

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rollBand(value) {
    const band = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return ['great', 'success', 'cost', 'failure', 'bad'].includes(band) ? band : null;
}

function difficultyValue(value) {
    return Math.min(5, Math.max(0, Math.trunc(finite(value, 0))));
}

/** The practice points from one check: a trivial check teaches 1 (a plain use); a failure 3, a success or a success at a cost 5, a success at hard or harder 10. */
export function practiceGain(band, difficultyIndex) {
    const key = rollBand(band);
    if (!key) return 0;
    const difficulty = difficultyValue(difficultyIndex);
    if (difficulty === 0) return 1;
    if (key === 'failure' || key === 'bad') return 3;
    return difficulty >= 3 && key !== 'cost' ? 10 : 5;
}

/** The level reached at a total experience (100 xp a level, as the RPG's), and the total needed for the next level (null at 99). */
export function levelFor(xp) {
    const total = Math.min(LEVEL.xpMax, Math.max(0, finite(xp, 0)));
    const level = Math.min(LEVEL.max, 1 + Math.floor(total / LEVEL.xpPerLevel));
    return { level, next: level < LEVEL.max ? level * LEVEL.xpPerLevel : null };
}
