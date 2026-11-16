// Holds the reader's unsent board choices in chat metadata, never as game-state changes.
// The reply's resolver records the setup and choices; after capture only a fresh segment remains here.
// The opening carrier and attempt fix the seed, so a narrated swipe keeps the dice.
// Public face: re-exports its parts.
export { boardSession, boardPayload, boardKey } from './session-parts/current.js';
export { openBoard, stageExchange, discardBoard } from './session-parts/open.js';
export { priorBoard, lastBoard, linkBoard } from './session-parts/links.js';
export { receiveBoard, reconcileBoard } from './session-parts/carry.js';
export { markSend, readSend, clearSend } from './session-parts/send.js';
