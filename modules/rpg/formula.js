// The Standard stat formula (agreed 1 Nov): the pure numbers shared by the roll math, the bars and the turn order.
//
// Standard pairs a main stat
// with half of a second one and halves the sum, rounded down once at the end: (main + second/2)/2 = floor((2·main + second)/4).
// A skill puts its own stat in the main slot; nothing is added on top. Pure: no DOM, no state, no randomness.
// Public face: re-exports its parts.
export { STAT_KEYS, ROLL_TYPES, STANDARD_NUMBERS, TYPE_STATS } from './formula-parts/constants.js';
export { pair, statPart } from './formula-parts/stat-part.js';
export { luckWindow, LUCK_STEPS, edgeWithLuck } from './formula-parts/luck.js';
export { blocksFor } from './formula-parts/bars.js';
export { levelBonus, levelOfClass, classOfLevel } from './formula-parts/levels.js';
export { foeHealthBlocks, foeBonus } from './formula-parts/foe-numbers.js';
export { initiativeBonus, foeInitiativeBonus, quickStart, turnOrder } from './formula-parts/turn-order.js';
export { companionStats } from './formula-parts/companion.js';
