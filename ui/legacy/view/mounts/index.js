// Story Suite v2: the five mounts (SPEC §13.4) built from one set of dependencies (see common.js).
// Each controller has `mount(el, screenId, opts)`; the rest is per mount (tabs register, the game view
// opens and closes, cards follow the chat, the hud sits above the message box, dialogs run wizards).
// Public face: re-exports its parts.

export { createCardMount, changeSummary } from './card.js';
export { createDialogMount } from './dialog.js';
export { createHudMount } from './hud.js';
export { createScreenMount } from './screen.js';
export { createTabMount } from './tab.js';
export { drawScreen } from './common.js';
export { createMounts } from './index-parts/create.js';
