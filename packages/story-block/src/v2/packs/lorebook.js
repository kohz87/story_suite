// Packs carried in a character card's lorebook (pure).
//
// A creator puts pack.json into a lorebook entry and tags the entry's title (SillyTavern's
// "Title/Memo", the entry's `comment`) with `[storysuite:pack]`. The entry should be disabled
// so SillyTavern never puts the JSON into a prompt; disabled entries are read all the same.
// The SillyTavern side (which book, loading it) is in st-adapter.js; this file only picks
// the tagged entries out of plain entry objects and unwraps their text.
// Public face: re-exports its parts.

export { PACK_TAG, isPackTitle, entryText, findPackEntries } from './lorebook-parts/pack-entries.js';
export { PORTRAITS_TAG, isPortraitsTitle, findPortraitEntries } from './lorebook-parts/portraits-entries.js';
export { SETTINGS_TAG, isSettingsTitle, findSettingsEntries } from './lorebook-parts/settings-entries.js';
export { readMarketLine, marketEntries } from './lorebook-parts/market-lines.js';
