// Names the slots that hold several pieces and reads the base slot out of a worn stack's key.

// Slots that hold several pieces, each under its own key (`accessory-1`, `accessory-2`),
// with the count when no module says otherwise. Every other slot holds one piece.
// The counts come from the `items.slots` query ({ accessory, worn }, or
// `accessories`), held to 0…MAX_MANY.
export const MANY_SLOTS = Object.freeze({ accessory: 2, worn: 1 });

export const MAX_MANY = 3;

/** The slot a worn stack's key stands for: `accessory-2` → `accessory`. */
export const baseSlot = key => (typeof key === 'string' ? key.trim().replace(/-\d+$/, '') : null);

const keyNumber = key => Number(/-(\d+)$/.exec(String(key ?? ''))?.[1] ?? 0);
