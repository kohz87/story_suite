/* NPC State Delta dossier surface: the Board screen (dial, name and status, tiles). Pure markup from boardModel and dialHtml; no DOM access and no listeners. The dial and the tiles carry data-delta-screen / data-delta-section for the screens module's delegated click handler. Public face: re-exports its parts. */
export { signedText, meterRowHtml, moodRowsHtml, pullRowHtml } from './dossier-ui-board-parts/meter-rows.js';
export { boardTileHtml } from './dossier-ui-board-parts/tile.js';
export { boardTiles } from './dossier-ui-board-parts/tiles.js';
export { boardHtml } from './dossier-ui-board-parts/screen.js';
