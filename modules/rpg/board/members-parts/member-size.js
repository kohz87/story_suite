// Sizes one foe's health bar in blocks, held to the block field's maximum.

import { foeBlocksByLevel } from '../../foes.js';
import { foeHealthBlocks } from '../../formula.js';
import { num } from './shared-numbers.js';

const hurtField = foe => `hurt${foe?.local ?? ((num(foe?.slot) - 1) % 4) + 1}`;

/** The blocks one foe of this slot has, held to the block field's maximum (`maxOf(module, field)`). */
export function memberSize(foe, maxOf = () => Infinity) {
    const blocks = foe?.levelled ? foe.size ?? foeBlocksByLevel(foe.level) : foeHealthBlocks(foe.class);
    const limit = typeof maxOf === 'function' ? maxOf(foe?.module, hurtField(foe)) : Infinity;
    return Math.max(1, Math.min(num(blocks) || 1, Number.isFinite(limit) ? limit : Infinity));
}
