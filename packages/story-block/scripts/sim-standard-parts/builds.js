// The stats of a focused or spread build at a Soul Class, and a skill's rank by Soul Class.
import { STAT_KEYS } from '../../../../modules/rpg/formula.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';

// ---- the builds -------------------------------------------------------------------------------------------------------

/** A skill's rank by Soul Class: Novice at I and II, Adept at III and IV, Expert at V and VI, Master from VII (practice is slow, so ranks lag). */
export const rankAt = soul => Math.min(3, Math.floor((soul - 1) / 2));

const raise = (stats, order, max) => {
    const key = order.find(name => stats[name] < max);
    if (key) stats[key] += 1;
};

/**
 * The stats of a build at a Soul Class under `numbers` (formula.js STANDARD_NUMBERS):
 * - focused: creation puts the skill's stat (STR) and DEX at the creation maximum; each Soul Class spends 3 of its points on the skill's stat
 *   and 1 on DEX until they are full, then the rest on VIT, AGI, INT, CHA, LUK and STR;
 * - spread: creation gives STR +3, DEX +2 and every other stat +1; each Soul Class point goes to the lowest stat.
 */
export function buildAt(kind, soul, numbers = STANDARD_FORMULA) {
    const stats = Object.fromEntries(STAT_KEYS.map(key => [key, numbers.startStat]));
    const max = numbers.statMax;
    const spill = ['vit', 'agi', 'int', 'cha', 'luk', 'str'];
    if (kind === 'focused') {
        stats.str = numbers.createMax; stats.dex = Math.min(numbers.createMax, numbers.startStat + (numbers.createPoints - (numbers.createMax - numbers.startStat)));
        for (let level = 2; level <= soul; level += 1) {
            for (let n = 0; n < numbers.pointsPerSoul; n += 1) raise(stats, n < numbers.pointsPerSoul - 1 ? ['str', 'dex', ...spill] : ['dex', 'str', ...spill], max);
        }
    } else {
        stats.str += 3; stats.dex += 2; for (const key of ['vit', 'agi', 'int', 'cha', 'luk']) stats[key] += 1;
        for (let level = 2; level <= soul; level += 1) {
            for (let n = 0; n < numbers.pointsPerSoul; n += 1) raise(stats, [...STAT_KEYS].sort((a, b) => stats[a] - stats[b]), max);
        }
    }
    return stats;
}
