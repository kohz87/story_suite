// The Inventory header's inline form for the reader's own items, the folded "Worn (N)" row (gear on), and the Grid view's two widgets:
// the List | Grid switch and the grid itself (tiles, folding categories, Worn per wearer, the item sheet; helpers in inventory-grid.js).
// Public face: re-exports its parts.

export { INVENTORY_ADD_WIDGET, createInventoryAddWidget } from './inventory-add-parts/add.js';
export { WORN_FOLD_WIDGET, createWornFoldWidget } from './inventory-add-parts/worn-fold.js';
export { INVENTORY_VIEW_WIDGET, createInventoryViewWidget } from './inventory-add-parts/view.js';
export { INVENTORY_GRID_WIDGET, createInventoryGridWidget } from './inventory-add-parts/grid.js';
