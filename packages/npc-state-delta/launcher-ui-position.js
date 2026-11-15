/* NPC State Delta launcher position helpers: viewport clamping, compact position records, saved
   position reads/writes and the visual-viewport size. Split from launcher-ui.js without change;
   launcher-ui.js keeps its public exports. Public face: re-exports its parts. */
export { finite } from './launcher-ui-position-parts/shared-number.js';
export { clampLauncherPosition } from './launcher-ui-position-parts/clamp.js';
export { launcherPositionRecord, readStoredPosition, saveStoredPosition } from './launcher-ui-position-parts/stored-position.js';
export { viewportSize } from './launcher-ui-position-parts/viewport.js';
