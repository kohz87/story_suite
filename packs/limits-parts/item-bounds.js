// The numeric bounds for an item's carry capacity and gear bonus.

// `carry`: the carry capacity an item adds while it is owned (worn, when it is equipment), a whole number
// (PACKS.md "Carry capacity"). Only a pack (or the reader's settings in a carry module) sets it; the story never does.
export const ITEM_CARRY = Object.freeze({ min: 1, max: 1000 });
// `bonus`: the gear bonus an item gives while worn (0–6), instead of the one its rarity gives (`story-block.gear`). A pack sets it; the story never does.
export const ITEM_BONUS = Object.freeze({ min: 0, max: 6 });
// `soak`: the soak an item gives while worn (0–2; the slot's cap holds it further: body 2, off-hand 2, head 1, the rest none). A pack sets it; the story's `soak: N` is held by the same caps.
export const ITEM_SOAK = Object.freeze({ min: 0, max: 2 });
