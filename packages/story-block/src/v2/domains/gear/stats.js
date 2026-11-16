// Gear's slots, rarity, stat budgets and story-made definitions (moved out of domains/gear.js unchanged;
// gear.js re-exports every public name). gearDefine updates the supplied item definition in place.
// Public face: re-exports its parts.

export { GEAR } from './stats-parts/constants.js';
export { slotWordOf, placeOf, gearSlotOf } from './stats-parts/slots.js';
export { gearRarityOf } from './stats-parts/rarity.js';
export { statsOf, withinBudget, packBonus, gearBudget } from './stats-parts/budget.js';
export { defaultStat, statsFor } from './stats-parts/stat-choice.js';
export { handDef } from './stats-parts/hand.js';
export { gearDefine } from './stats-parts/define.js';
export { soakFor, soakCap, packSoak } from './stats-parts/soak.js';
export { soakTotal } from './stats-parts/soak-total.js';
export { weightFor, defaultWeight, packWeight } from './stats-parts/weight.js';
