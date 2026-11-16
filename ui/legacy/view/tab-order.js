// Story Suite v2: the reader's order for the tabs and screens (Settings → Tabs & Packs → Tabs). One list
// covers both places: the Story panel's tab strip (module tabs and tab screens) and the game view's
// navigation (screens), so moving Fight up moves it in both.
//
// * Kept in extension_settings.storySuite.tabs as { order: [id…], hidden: [id…] } (the reader's, every
//   chat). An id is a screen's ('example-module/fight'), or for a module's own tab "<module>/<tab id>"
//   ('npc-state-delta/cast', the same id as Cast's screen, so the two are one entry).
// * No saved order: the default (screens.js screenOrder). A saved order puts the ids it names first, in its
//   order; anything it does not name (a module installed since) follows at the end, in default order.
//   An id it names that is not there (a module removed) is passed over, and kept for when it comes back.
// * Home is always first and always shown: it cannot be moved or hidden.
// * Hidden ids leave the tab strip and the game view's navigation; Settings still lists them to show again.
// * Hidden by default (screens.js DEFAULT_HIDDEN): Scene while the screen that shows the same and more is registered. The
//   reader's choice wins: `shown` lists the ones the reader showed again, `hidden` the ones they hid. An
//   order saved before `shown` existed that names Scene counts as showing it (the reader had it in view).
// * The bar: the game view's navigation and the Story panel's tab strip hold the screens that say `bar: true` on their own
//   registration (Home, Inventory, and whatever other modules declare), and Party and Fight, which come with the RPG; every other
//   screen is under More. The reader's choice wins: `inBar`
//   lists the ones they put in the bar, `underMore` the ones they put under More. Home is always in the bar. Where the bar has
//   no room (a phone's five slots) the ones past the room go under More as well.
//
// Pure, apart from createTabOrderStore (which reads and writes the reader's settings through `ctx`).
//
// Public face: re-exports its parts.

export { TAB_SETTINGS_KEY, TAB_LIST_MAX, TAB_ID_MAX } from './tab-order-parts/constants.js';
export { readTabChoice, isDefaultChoice } from './tab-order-parts/choice.js';
export { isInBar, setNavInBar } from './tab-order-parts/bar.js';
export { navKey, orderNav, moveNav } from './tab-order-parts/order.js';
export { isHiddenNav, visibleNav, setNavHidden } from './tab-order-parts/hidden.js';
export { createTabOrderStore } from './tab-order-parts/store.js';
