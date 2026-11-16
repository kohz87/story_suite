// The inventory domain's read side (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): the
// items as a list, the equipment view, what the carried gear adds, the load and its encumbrance (never stored: derived from the
// state), the definitions, and the domain's query table (`createInventoryQueries`). Display and query only; nothing here writes.
// Public face: re-exports its parts.

export { carryAnswer, carryBonuses, defCarry } from './queries-parts/carry.js';
export { listItems } from './queries-parts/list.js';
export { equipmentView } from './queries-parts/equipment.js';
export { ENCUMBERED_PENALTY, ENCUMBERED_STATS, encumbrance, encumbranceTail } from './queries-parts/encumbrance.js';
export { DEFINITIONS_MAX_IDS, definitionsOf } from './queries-parts/definitions.js';
export { gearIsOn, gearWearers, boundNames } from './queries-parts/gear-names.js';
