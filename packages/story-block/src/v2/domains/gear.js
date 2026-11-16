// Gear in fights, the inventory side (`story-block.gear`, docs/v2/GEAR.md). This path keeps every public export;
// the rules live in gear/stats.js (slots, rarity and stat budgets), gear/carry.js (capacity and mounts),
// gear/views.js (the gear query answers) and gear/conditions.js (wear words and prices). Pure.
// Public face: re-exports its parts.

export { GEAR, slotWordOf, placeOf, gearSlotOf } from './gear-parts/stats-slots.js';
export { gearRarityOf, statsOf, withinBudget, defaultStat } from './gear-parts/stats-rarity.js';
export { gearDefine, handDef, packBonus, gearBudget } from './gear-parts/stats-defs.js';
export { KIND_CARRY, OTHER_CARRY, kindCarry, itemCarryOf } from './gear-parts/carry-mounts.js';
export { travelsWith, capacityFor, atLimit, loadLevel } from './gear-parts/carry-load.js';
export { carryPicture, carryAnswer } from './gear-parts/carry-picture.js';
export { statBonus, gearAnswer, bonusText, gearView } from './gear-parts/views-answers.js';
export { soakFor, soakCap, packSoak, soakTotal, soakRecord } from './gear-parts/views-soak.js';
export { weightFor, defaultWeight, packWeight } from './gear/stats.js';
export { createGearQueries, statsFor } from './gear-parts/views-queries.js';
export { CONDITION, condWord, condMark, valueByCond } from './gear-parts/conditions-words.js';
export { stepDown, stepUp } from './gear-parts/conditions-steps.js';
