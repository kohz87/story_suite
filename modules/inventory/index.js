// The `inventory` domain (§7): item definitions, stacks, wallets and the alias index, with
// its validator, commands, capture kinds `item` and `coin`, queries and prompt view. Pure.
//
// Handlers follow §3.2: synchronous, everything through ctx (read/draft/call/claim/rng/fail).
// A stack whose count reaches 0 is removed, never kept at 0 (§2.5). Numbers are set by code:
// a change line proposes, these functions decide. Payloads, codes and money follow MODULES.md F:
// a rule refusal is REFUSED, a malformed payload INVALID; a wallet is { coin: n } in the smallest unit.

export { validateInventory } from './slice.js';
export { createInventoryQueries } from './answers.js';
export { TOLD, createInventoryCommands } from './commands.js';
export { USED_WORDS, GONE_WORDS, usedByLine, captureItem, captureCoin } from './story.js';
export { LOOT_ITEMS, LOOT_KEEP, LOOT_GUARD, LOOT_OFFER, LOOT_KINDS, captureLoot, lootTakeGuard } from './loot.js';
export { kitOpen, INVENTORY_EDIT_GUARD, inventoryEditGuard } from './edit.js';
export { ECONOMY_SCALE, economyOf, scaledDefault } from './stacks.js';
export { STORY_WEAR, wearWord } from './wear.js';
export { DEFINITIONS_MAX_IDS, carryBonuses, listItems, equipmentView, ENCUMBERED_PENALTY, defCarry, ENCUMBERED_STATS, encumbrance, encumbranceTail, definitionsOf } from './queries.js';
export { KINDS, RARITIES, KIND_ORDER, initialInventory, FEATURE, INVENTORY_FEATURES, gearOn, featureOn, COND_MAX, COND_LOG_MAX, condEvents, condOf, defaultDef, CARRY_MAX, packCarry } from './state.js';
export { itemText, legendEarned, MANY_SLOTS, MAX_MANY, baseSlot, slotLimits, canWear } from './validate.js';
export { promptNote, WALLET_NOTE, inventoryTail } from './prompt.js';
