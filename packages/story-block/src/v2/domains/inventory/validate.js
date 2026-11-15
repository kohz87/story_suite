// The inventory domain's read-only rules (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): an
// item's text, whether a legendary has been earned, and which party members can wear what in which slot. Pure functions of the
// state they are given.
// Public face: re-exports its parts.

export { itemText } from './validate-parts/item-text.js';
export { legendaryEarned, legendEarned } from './validate-parts/legend.js';
export { MANY_SLOTS, MAX_MANY, baseSlot } from './validate-parts/slots.js';
export { asking } from './validate-parts/shared-asking.js';
export { slotLimits } from './validate-parts/limits.js';
export { membersOf, pcOf } from './validate-parts/party.js';
export { canWear } from './validate-parts/wear-check.js';
