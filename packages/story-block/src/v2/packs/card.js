// What a character card carries besides its pack: the two formats of its other tagged lorebook entries (pure).
//
// `[storysuite:portraits]`: `{ "v": 1, "pack": "<pack id>", "version": "<pack version>", "files": { "<file name>": "data:image/webp;base64,…" } }`
// `[storysuite:settings]`:  `{ "v": 1, "settings": { "<owner>.<key>": value } }`
//
// Both are read as data and checked before anything is offered: a rejected entry, a skipped picture and a skipped key each give one
// plain line (`lines`) for Diagnostics, so an author can see why something was not offered. Nothing here installs or writes anything.
// Public face: re-exports its parts.

export { CARD_LIMITS, CARD_SETTING_KEYS } from './card-parts/limits.js';
export { portraitsPackOf, readPortraitsEntry } from './card-parts/portraits.js';
export { readSettingsEntry } from './card-parts/settings.js';
