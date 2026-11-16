// The numeric bounds for an item's carry capacity and gear bonus.

// `carry`: the carry capacity an item adds while it is owned (worn, when it is equipment), a whole number
// (PACKS.md "Carry capacity"). Only a pack (or the reader's settings in a carry module) sets it; the story never does.
export const ITEM_CARRY = Object.freeze({ min: 1, max: 1000 });
// `bonus`: the gear bonus an item gives while worn (0–6), instead of the one its rarity gives (`story-block.gear`). A pack sets it; the story never does.
export const ITEM_BONUS = Object.freeze({ min: 0, max: 6 });
