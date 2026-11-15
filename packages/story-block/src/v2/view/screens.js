// Story Suite v2: the screen registry (SPEC §13.1, §13.7). Every screen is data; this module keeps the
// definitions from every source, checks them, and answers "which definition does screen X use now?".
//
// * Sources, strongest first: the reader's choice (settings), the card's, a pack's, the module default.
//   Packs are kept in the order they were first set; the one set last wins among packs.
// * The reader's choice is either a whole screen definition (the reader's own version) or a pin
//   `{ use: 'module' | 'card' | 'pack' | 'pack:<id>' }`. `reset(id)` pins the module default; `clearChoice`
//   drops the reader's entry so the normal order applies again.
// * A definition that fails `validateScreen` is skipped: the next source is used and the reason is kept
//   (`resolve(id).fallbacks`, `problems()`) for the settings overlay.
// * Data bindings (`data: { alias: { query, args } }`) run in dependency order: an argument written as
//   `$alias.path` takes the value of an earlier binding. An unknown alias or a cycle is an error.
//
// * Navigation order (the game view, the Story panel's tabs), before the reader's own (view/tab-order.js):
//   the suite's own screens in DEFAULT_ORDER (Home, Party, Inventory, Quests, World, Map, Fight,
//   Crafting, Trade, Scene, Chronicle, then any other screen, the Director, the game master's view, and
//   NPC State Delta's Dossiers, the dossier browser, last); another screen may say `order` (a number, lower first) or takes DEFAULT_ORDER's place for
//   the last part of its id, else REST_ORDER. Home is always first: no order a module gives can move it down.
//
// * A theme's values pass the same checks the page applies (css.js themeVars: one CSS value each, nothing
//   that loads or runs anything but data:/https:); a screen with one unsafe value is skipped as a whole.
//
// Pure: no DOM, no SillyTavern. Reader settings come in and go out through injected functions.
// Public face: re-exports its parts.

export { MOUNTS, SOURCES, CSS_LIMIT, SUMMARY_MAX } from './screens-parts/constants.js';
export { HOME_ID, DEFAULT_ORDER, DEFAULT_HIDDEN, REST_ORDER } from './screens-parts/nav-places.js';
export { inDefaultBar, SUITE_NAV, screenOrder, byNavOrder } from './screens-parts/nav-order.js';
export { validateScreen } from './screens-parts/validate.js';
export { dataOrder, resolveData } from './screens-parts/data.js';
export { createScreens } from './screens-parts/registry.js';
