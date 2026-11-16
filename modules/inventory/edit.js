// The inventory domain's hand-set gear and the reader's edit guard (moved out of domains/inventory.js unchanged; inventory.js re-exports
// every public name): the starting kit, the stats and slot a reader sets, remaking a piece as equipment, and the replay guard of a reader edit.
// Public face: re-exports its parts.

export { kitOpen, handStats, holdBudget, handSlot } from './edit-parts/kit.js';
export { remakeAsEquipment, handPlace, wantsRepoint, repoint } from './edit-parts/remake.js';
export { handEdit } from './edit-parts/hand-edit.js';
export { numberEdit } from './edit-parts/number-edit.js';
export { byReader, setCarry } from './edit-parts/carry.js';
export { editStack, editPieces, addDecision, renameDecision } from './edit-parts/witness.js';
export { INVENTORY_EDIT_GUARD, guardReaderEdit, inventoryEditGuard } from './edit-parts/guard.js';
