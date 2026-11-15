// How many blocks each bar of a character has.
import { statOf } from './shared-num.js';

/**
 * How many blocks each bar has. Scale 1 (every pin made before the scale mark, kept forever): Health 4 + VIT/5, Stamina 3 + AGI/5, Mana 3 + INT/5 (rounded down).
 * Scale 2 (a pin with `scale: 2` on its bars): each bar is 2 × (4 + stat/5), so VIT 5, AGI 10, INT 5 give 10 / 12 / 10.
 */
export function blocksFor(stats, scale = 1) {
    if (scale === 2) {
        return {
            health: 2 * (4 + Math.floor(statOf(stats, 'vit') / 5)),
            stamina: 2 * (4 + Math.floor(statOf(stats, 'agi') / 5)),
            mana: 2 * (4 + Math.floor(statOf(stats, 'int') / 5)),
        };
    }
    return {
        health: 4 + Math.floor(statOf(stats, 'vit') / 5),
        stamina: 3 + Math.floor(statOf(stats, 'agi') / 5),
        mana: 3 + Math.floor(statOf(stats, 'int') / 5),
    };
}
