// The inventory domain's loot offers (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): the
// offer's shape check, reading and capturing a `? loot` line, taking from an offer and the guard of the loot blocks.
// Public face: re-exports its parts.

export { LOOT_ITEMS, LOOT_KEEP } from './loot-parts/limits.js';
export { LOOT_GUARD, LOOT_OFFER, LOOT_KINDS } from './loot-parts/guard-names.js';
export { lootErrors, lootItems } from './loot-parts/offer-shape.js';
export { captureLoot } from './loot-parts/capture.js';
export { lootTake } from './loot-parts/take.js';
export { lootTakeGuard } from './loot-parts/guard.js';
