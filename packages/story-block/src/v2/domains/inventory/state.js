// The inventory domain's shape (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): the item kinds
// and rarities, the empty inventory, the optional mechanics the domain owns and how to ask whether one is on, an item's condition
// and its log, the default definition, the carry constants, and the shape checks for a definition and a kept stack. Pure.
// Public face: re-exports its parts.

export { KINDS, RARITIES, STORY_KIND, KIND_ORDER } from './state-parts/kinds.js';
export { MAX_NAME, MAX_NOTE, MAX_UNSTACKED } from './state-parts/limits.js';
export { initialInventory, defaultDef, isCount, nonBlank } from './state-parts/shape.js';
export { FEATURE, INVENTORY_FEATURES, RPG_MODULE } from './state-parts/features.js';
export { gearOn, featureOn } from './state-parts/feature-checks.js';
export { COND_MAX, COND_LOG_MAX } from './state-parts/shared-cond.js';
export { condEvents, condOf } from './state-parts/cond-read.js';
export { condWrite, condLogErrors } from './state-parts/cond-write.js';
export { CARRY_MAX, READER_CARRY_MAX, packCarry } from './state-parts/carry.js';
export { defErrors, keptErrors } from './state-parts/checks.js';
