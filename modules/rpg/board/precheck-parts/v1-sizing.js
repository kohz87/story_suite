// The Combat Rules v1 encounter-size rule for the pre-check's groups (owner answer, locked bands): an even fight is at most 4 standard foes in all, and a group of elites, bosses or apexes at most 3.
// Mobs and minions are small foes and keep the count the reader gave (the Foes block's own maximum still applies). Code sets the numbers: a bigger crowd is cut to the rule, never refused, and a group cut to none is dropped.
import { V1, TIERS } from '../../combat/numbers.js';

/** The most standard foes in one even fight, and the most of a tier above standard in one group. */
export const FIGHT_SIZE = Object.freeze({ standard: 4, above: 3 });
const ABOVE = new Set(['elite', 'boss', 'apex']);

/** The tier word of a model's answer: one of the engine's tiers, else the default (standard). */
export const tierWord = value => {
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return Object.hasOwn(TIERS, word) ? word : V1.foe.defaultTier;
};

/** The groups `[{ name, count, tier, … }]` held to the rule above, in their order (the earlier groups keep the room). */
export function sizeGroups(groups) {
    let room = FIGHT_SIZE.standard;
    return groups.flatMap(group => {
        const tier = tierWord(group.tier);
        let count = group.count;
        if (tier === 'standard') { count = Math.min(count, room); room -= count; }
        else if (ABOVE.has(tier)) count = Math.min(count, FIGHT_SIZE.above);
        return count > 0 ? [{ ...group, tier, count }] : [];
    });
}
