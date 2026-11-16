// Packs (SPEC §9, MODULES §E): a part of Story Block's core module.
//
// A pack is a pack.json of plain data: items, creatures, shops, recipes, events, quests, a
// start state, screens, layouts and a theme. Packs are installed from a file or from a character's
// lorebook into `extension_settings.storySuite.packs` and read by other parts through the
// queries and hooks below. The part has no domain and no commands: installing a pack is a
// settings change, not a story event, and what a pack gives a chat is copied into the chat's
// state by its owner (inventory for item defs, the host for the start state).
//
// Interface for the other parts:
// * query `packs.list` → installed packs for display (`installed.js` list()).
// * query `packs.content({ kind, pack? })` → records of one kind from enabled packs (places and
//   routes are the map Story Director's atlas reads; other content is available to modules).
// * query `packs.portrait({ pack, file })` → the safe image URL of a cast portrait the pack names (`/user/files/…`), or null: the pack
//   is not installed, does not name that file, no picture was imported with it, or the file is gone (portraits.js).
//   `packs.content({ kind: 'cast' })` gives each person with `pack` and `packVersion` (cast.js).
// * query `packs.castGear({ name })` → a cast member's signature gear for the narrator's cast entry (`{ name, line, items }`), or null (cast.js `gear`).
// * query `packs.calendar` → the first enabled pack's calendar for the story clock, or null.
// * query `packs.crafts` → the craft table (default crafts, enabled packs' `crafts` laid over them:
//   `[{ craft, title, stats, stations, note?, pack }]`) for modules that use recipes.
// * query `packs.weather` → the first enabled pack's weather table `{ pack, seasons, tables }`, or null
//   (MODULES §F122: Story Director's weather by rule).
// * query `packs.ripples` → the first enabled pack's ripples table `{ pack, powers, tiers?, caps?, worldDirections? }`, or null.
// * query `packs.youRank` → `{ pack, label }` of the first enabled pack with `content.you.rank`, or null (MODULES §F126).
// * query `packs.economy` → the first enabled pack's money scale `{ pack, scale, note }`, or null. Modules
//   read the settled scale through Story Block's `inventory.economy` instead (MODULES §F104).
// * query `packs.markets` → what sets a place's prices (PACKS.md "Markets"): `{ types, tags, places }`,
//   the enabled packs' `markets` records (settlement types and environment tags, the first pack's per
//   name) and the places with a market: the character lorebook's `market:` lines first
//   (`from: 'lorebook'`), then the packs' places that name a `market` or `tags` (`from: 'pack'`).
//   A module may use these records to set prices. The lorebook is read when a chat opens
//   (`refreshLore()`) and from the Packs panel, never by a query.
// * query `packs.item({ name })` and hook `item.resolve(name)` → the pack item def a story
//   name means (`pack.<packId>/<slug>`, SPEC §7 shape) or null. Inventory capture calls it
//   after its own aliases and before it creates a `story/<slug>` def.
// * query `packs.start` and hook `start()` → the enabled packs' start, merged (SPEC §2.6);
//   `applyStart(state, start, { id })` writes it into an initial State.
//
// Public face: re-exports its parts.

export { contentOf, calendarOf, craftsOf, economyOf } from './index-parts/reexport-content.js';
export { weatherOf, ripplesOf, youRankOf, resolveItemIn } from './index-parts/reexport-content-more.js';
export { applyStart, mergeStart, slugify, createInstalled } from './index-parts/reexport-install.js';
export { LIMITS, CONTENT_KINDS, DEFAULT_CRAFTS, STATIONS } from './index-parts/reexport-limits.js';
export { findPackEntries, marketEntries, readMarketLine, PACK_TAG } from './index-parts/reexport-lorebook.js';
export { renderPacksPanel, satisfies } from './index-parts/reexport-panel.js';
export { validateDataModules, validateDataMigration, dataModuleDefaults, dataModuleHash } from './index-parts/reexport-data-modules.js';
export { DM_DESCRIPTORS, DM_LIMITS, DM_DIAGNOSTICS, DATA_MODULES_CAPABILITY } from './index-parts/reexport-data-constants.js';
export { createPacksPart } from './index-parts/build.js';
export { marketsOf } from './index-parts/markets.js';
export { part, packs, portraits } from './index-parts/live.js';
export { resolveItem, startState, economy, refreshLore } from './index-parts/live-handles.js';
