// Turns a staged/opened board fight into plain text and numbers for the start views.
// It reads the sheet without changing it; the offer line and pause view never read game state themselves.
// Foe names stay text (never markup), and the helper is safe to call while a preview is still waiting.
// Public face: re-exports its parts.
export { OFFER_BOARD_LABEL, OFFER_AUTO_LABEL, PAUSE_BOARD_LABEL, PAUSE_SEND_LABEL } from './start-view-data-parts/labels.js';
export { autoFightLabel, pauseViewData } from './start-view-data-parts/pause-view.js';
export { fightFoes } from './start-view-data-parts/fight-foes.js';
export { offerLineData } from './start-view-data-parts/offer-line.js';
