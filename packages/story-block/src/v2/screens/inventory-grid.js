// Inventory grid: the pure DOM helpers of the Grid view on the Inventory screen (inventory.js keeps the screen, the List view and the template).
// Every helper takes the document first and returns an element; none reads the store or runs a command. The screen passes the rows
// (`q.gx.rows` while Gear in fights is on, else null), the same action commands and payloads the list rows use, and the fold state it keeps
// (foldStore). A tile is a button, so the keyboard and screen readers reach every item.
//
// Public face: re-exports its parts.

export { foldStore, foldSection } from './inventory-grid-parts/folds.js';
export { itemTile, tileGrid } from './inventory-grid-parts/tiles.js';
export { categorySection, wornSection } from './inventory-grid-parts/sections.js';
export { itemSheet } from './inventory-grid-parts/sheet.js';
export { GRID_CSS } from './inventory-grid-parts/css.js';
