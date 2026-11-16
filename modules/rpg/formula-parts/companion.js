// The stats of a companion the story adds on the Standard scale.
import { STAT_KEYS, STANDARD_NUMBERS } from './constants.js';
import { num } from './shared-num.js';

/**
 * A companion the story adds on the Standard scale: every stat 5, the best stat 9, then one point for every third level
 * (floor(level / 3), the same as the Character's own rise) spent one at a time on the best stat and DEX in turn (each up to statMax); once both are full, the rest
 * go to VIT, then AGI, INT, CHA, LUK and STR in that order, so no point is left unspent.
 */
export function companionStats(best, level, numbers = STANDARD_NUMBERS) {
    const max = num(numbers.statMax);
    const stats = Object.fromEntries(STAT_KEYS.map(key => [key, num(numbers.startStat)]));
    const lead = STAT_KEYS.includes(best) ? best : 'str';
    stats[lead] = Math.min(max, num(numbers.startStat) + 4);
    const pairKeys = lead === 'dex' ? ['dex', 'agi'] : [lead, 'dex'];
    const spill = ['vit', 'agi', 'int', 'cha', 'luk', 'str'].filter(key => !pairKeys.includes(key));
    let points = Math.floor(Math.max(0, num(level)) / 3);
    for (let turn = 0; points > 0; turn += 1) {
        const first = pairKeys[turn % 2], second = pairKeys[(turn + 1) % 2];
        const target = [first, second, ...spill].find(key => stats[key] < max);
        if (!target) break;
        stats[target] += 1; points -= 1;
    }
    return stats;
}
