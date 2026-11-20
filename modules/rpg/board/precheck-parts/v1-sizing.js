// The Combat Rules v1 encounter-size rule for the pre-check's groups (owner answer, locked bands): an even fight is at most 4 standard foes in all, and a group of elites, bosses or apexes at most 3.
// Mobs and minions are small foes and keep the count the reader gave, up to the Foes block's own maximum a slot (V1.foe.groupMax: a count past it cannot be written, so the whole opening
// failed and the reply went on with no fight: "a dozen rats", 19 Nov). A bigger crowd of mobs or minions is split into groups of that size, each its own slot ("Rats", "Rats (2)";
// owner, 20 Nov: twelve rats stay twelve), as far as the Foes block's slots go. Code sets the numbers: a crowd past the rule is cut, never refused, and a group cut to none is dropped.
import { V1, TIERS } from '../../combat/numbers.js';
import { FOE_SLOTS } from '../../names-parts/rules.js';

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
    const sized = groups.flatMap(group => {
        const tier = tierWord(group.tier);
        let count = group.count;
        if (tier === 'standard') { count = Math.min(count, room); room -= count; }
        else if (ABOVE.has(tier)) count = Math.min(count, FIGHT_SIZE.above);
        else {
            // (mobs and minions: groups of at most groupMax, the later ones named "<name> (2)", "(3)" …)
            const parts = [];
            for (let left = count, n = 1; left > 0; left -= V1.foe.groupMax, n += 1) parts.push({ ...group, tier, name: n === 1 ? group.name : `${group.name} (${n})`, count: Math.min(left, V1.foe.groupMax) });
            return parts;
        }
        return count > 0 ? [{ ...group, tier, count }] : [];
    });
    return sized.slice(0, FOE_SLOTS);
}
