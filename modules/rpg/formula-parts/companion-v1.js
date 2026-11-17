// The stats of a companion the story adds under Combat Rules v1.
import { STATS_V1 } from '../names-parts/stats.js';
import { V1 } from '../combat/numbers.js';

/**
 * A companion the story adds: every stat at the start (5), the best stat 4 higher, then one point for each level above the first (the Character's own rise: every level gives one) spent one at
 * a time on the best stat and DEX in turn (each up to the stat maximum, 30); once both are full the rest go to VIT, AGI, INT, CHA, WIS and STR in that order, so no point is left unspent.
 */
export function companionStatsV1(best, level) {
    const stats = Object.fromEntries(STATS_V1.map(key => [key, V1.stat.start]));
    const lead = STATS_V1.includes(best) ? best : 'str';
    stats[lead] = Math.min(V1.stat.max, V1.stat.start + 4);
    const pairKeys = lead === 'dex' ? ['dex', 'agi'] : [lead, 'dex'];
    const spill = ['vit', 'agi', 'int', 'cha', 'wis', 'str'].filter(key => !pairKeys.includes(key));
    let points = Math.max(0, Math.floor(Number(level) || 1) - 1);
    for (let turn = 0; points > 0; turn += 1) {
        const first = pairKeys[turn % 2], second = pairKeys[(turn + 1) % 2];
        const target = [first, second, ...spill].find(key => stats[key] < V1.stat.max);
        if (!target) break;
        stats[target] += 1; points -= 1;
    }
    return stats;
}
