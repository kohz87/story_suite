// The public API, version 1 (docs/v2/PUBLIC-API.md): `StoryBlock.api`.
//
// A small frozen object for card authors and third-party scripts, separate from `sdk` (which is for modules and
// changes between releases): `version`, `host`, `ready`, `get(path)`, `paths()`, `on(event, fn)`. Read-only.
//
// Every value comes from the CURRENT head state through readers and queries that already exist (no state of its
// own): scene.* (the scene's `scene.place`, `scene.weather`, `scene.present` queries; the clock from Story
// Director's `director.time` when it answers), money (`inventory.wallet`, `inventory.currency`), items
// (`inventory.items`, the party's), party (the RPG's Character blocks, read.js, only while the RPG is on) and
// blocks (the pinned data-module blocks). Each value is a frozen plain copy.
//
// Hidden values are never returned, a hidden path reads as `undefined`:
//   * a data-module field the pack marks `prompt: false` (hidden from the story): in `blocks.*` and in `party.*`
//     (a hidden level, xp, bar or stat is left out of the member; a hidden Who is the block's name);
//   * a block shown nowhere (`show: { tab: false, card: false }`) and not an RPG role block: no `blocks.*` path;
//   * RPG role blocks while the RPG is off (off means fully off): no `party`, no `blocks.<role block>`.
//   Items, money and the scene have no hidden marks.
//
// Events (`story:changed`, `story:reply`, `story:rebuilt`, `story:chat`) are built on the internal `turn` and
// `head` events and delivered after Story Block has saved (a reply's state is written first). A listener that throws
// is caught and logged once; it never breaks a reply. The change list of `story:changed` is the difference of the
// public paths before and after the reply (store.before(index) against the head).
// Public face: re-exports its parts.

export { API_VERSION, API_EVENTS } from './public-api-parts/constants.js';
export { plainText } from './public-api-parts/text-of.js';
export { createReaders } from './public-api-parts/readers.js';
export { diffLeaves } from './public-api-parts/diff.js';
export { createPublicApi } from './public-api-parts/create.js';
