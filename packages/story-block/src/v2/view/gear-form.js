// The hand-set gear form (Gear in fights on): the fields and the commands of "+ Add item" and of the Edit of a piece the reader added, as plain data
// so both are tested without a page (as hero-edit.js does for the hero). The fields are those of `ss.editable` kind `fields`; the plans are its
// `plan(changed, all)`.
//
// Two groups: "Item" (Name, Count, Kind, Note) and, only while Kind is Equipment, "Gear" (Slot, Rarity, Bonus up to 2 stats with the live "N of M points" line,
// Equip on / Equipped by). The starting kit (`kit`: the chat has no message from the reader yet) offers Rarity and Bonus; after it Rarity is Common (disabled) and
// Bonus is left out of Add, and read-only in Edit. The commands enforce the same rules (inventory.js `handEdit`, `inventory.add`): this form only asks.
// Public face: re-exports its parts.

export { FORM_KINDS, NAME_MAX } from './gear-form-parts/shared-limits.js';
export { repointControls } from './gear-form-parts/repoint.js';
export { addFields, addPlan } from './gear-form-parts/add.js';
export { editFields, editPlan } from './gear-form-parts/edit.js';
