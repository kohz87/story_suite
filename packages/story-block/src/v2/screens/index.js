// Story Block's own default screens (SPEC §13.1–13.3), for the core module's
// `registerModule({ screens })`. Each is plain data: an id, where it may appear, the queries it reads,
// an HTML template and scoped CSS in SillyTavern's colours (MODULES §F18). Packs, cards and the reader
// can restyle or replace any of them by id (§13.7).
//
//   story-block/inventory     tab, screen   the party's things by kind; Equip / Drop; a filter box
//   story-block/scene         tab, screen   the place and who is there, with portraits from NSD
//   story-block/changes-card  card          "Changed this reply" under each reply
//   story-block/home          screen        the game view's landing page: a summary of every module,
//                                           and the save points (feature story-block.savepoints)
//   story-block/inspector     screen, tab   the state inspector, read-only (feature story-block.inspector)
//
// The card mount's collapsed header line comes from `changesSummary` (see changes-card.js).
//
// Public face: re-exports its parts.

export { inventoryScreen, INVENTORY_SCREEN_ID, KIND_TITLES } from './inventory.js';
export { sceneScreen, SCENE_SCREEN_ID } from './scene.js';
export { changesCardScreen, changesDigest, changesSummary, replyCardLines, CHANGES_CARD_SCREEN_ID, REPLY_LINES_MAX } from './changes-card.js';
export { homeScreen, HOME_SCREEN_ID } from './home.js';
export { inspectorScreen, INSPECTOR_SCREEN_ID } from './inspector.js';
export { BASE_CSS, RARITY_THEME } from './style.js';
export { screens } from './index-parts/list.js';
