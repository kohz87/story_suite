// The only part of packs that touches SillyTavern. Everything is read when called, never at
// import, so the rest of the part (and its tests) loads without SillyTavern.
//
// What it uses of `SillyTavern.getContext()`: `extensionSettings` and `saveSettingsDebounced`
// (the installed list), `characters` and `characterId` (the open card), and `loadWorldInfo`
// (the card's linked lorebook). A card whose lorebook was never imported still carries it
// embedded as `data.character_book`; that copy is read when no lorebook is linked, and its [storysuite:…] entries also when the linked
// one lacks them or cannot be loaded.
// Public face: re-exports its parts.

export { stSettings, saveSettingsNow } from './st-adapter-parts/settings.js';
export { readCharacterLorebook } from './st-adapter-parts/lorebook-read.js';
export { stCapabilities, stHostVersion } from './st-adapter-parts/host-info.js';
export { stPortraitFiles } from './st-adapter-parts/portrait-files.js';
