// HP, MP and SP of a hero from stats and level (Combat Rules v1). Each term rounds down.
// Stats are clamped to 1..30 and the level to 1..99 before use.

import { V1 } from './numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));
const stat = (stats, key) => clamp(stats?.[key], V1.stat.min, V1.stat.max);
const levelOf = level => clamp(level, V1.level.min, V1.level.max);

/** Health: 5 + level÷3 + VIT÷2. */
export function hpOf(stats, level) {
    return V1.hp.base + Math.floor(levelOf(level) / V1.hp.levelDiv) + Math.floor(stat(stats, 'vit') / V1.hp.vitDiv);
}

/** Mana: 8 + level÷4 + (INT+WIS)÷4. */
export function mpOf(stats, level) {
    return V1.mp.base + Math.floor(levelOf(level) / V1.mp.levelDiv) + Math.floor((stat(stats, 'int') + stat(stats, 'wis')) / V1.mp.pairDiv);
}

/** Stamina: 8 + level÷4 + (STR+AGI)÷4. */
export function spOf(stats, level) {
    return V1.sp.base + Math.floor(levelOf(level) / V1.sp.levelDiv) + Math.floor((stat(stats, 'str') + stat(stats, 'agi')) / V1.sp.pairDiv);
}

/** All three bars as full values. */
export function barsOf(stats, level) {
    return { hp: hpOf(stats, level), mp: mpOf(stats, level), sp: spOf(stats, level) };
}
