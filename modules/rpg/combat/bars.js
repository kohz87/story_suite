// HP, MP and SP of a hero from stats and level (Combat Rules v1). Each term rounds down.
// Stats are clamped to 1..30 and the level to 1..99 before use; a missing stat reads as the start value (V1.stat.start).
// Every bar is fed by a pair of stats (numbers.js `pair`): HP by STR and VIT, MP by INT and WIS, SP by AGI and DEX.

import { V1 } from './numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));
const stat = (stats, key) => clamp(Number.isFinite(Number(stats?.[key])) && stats[key] !== null && stats[key] !== '' ? stats[key] : V1.stat.start, V1.stat.min, V1.stat.max);
const levelOf = level => clamp(level, V1.level.min, V1.level.max);
const barOf = (rule, stats, level) => rule.base + Math.floor(levelOf(level) / rule.levelDiv) + Math.floor((stat(stats, rule.pair[0]) + stat(stats, rule.pair[1])) / rule.pairDiv);

/** Health: 5 + level÷3 + (STR+VIT)÷4. */
export function hpOf(stats, level) {
    return barOf(V1.hp, stats, level);
}

/** Mana: 8 + level÷4 + (INT+WIS)÷4. */
export function mpOf(stats, level) {
    return barOf(V1.mp, stats, level);
}

/** Stamina: 8 + level÷4 + (AGI+DEX)÷4. */
export function spOf(stats, level) {
    return barOf(V1.sp, stats, level);
}

/** All three bars as full values. */
export function barsOf(stats, level) {
    return { hp: hpOf(stats, level), mp: mpOf(stats, level), sp: spOf(stats, level) };
}
