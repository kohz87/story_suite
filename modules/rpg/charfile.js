// A saved character (Export / Import a character): the file the Party tab's Export writes and the New character wizard's Import reads.
// Pure: no DOM. It holds only what the user chose to carry between chats: Soul Class, unspent points, the seven stats, up to eight skills
// (name, what it does, stat (left out for a skill whose block has none: a stat is never guessed), Stamina or Mana, rank), and, if left on, the things the character carries and the purse.
//
//   { "storySuiteCharacter": 1, "soul": 2, "points": 3, "stats": { "str": 14, … "cha": 10 },
//     "skills": [{ "name", "about", "stat"?, "uses", "rank" }], "items"?: [{ "name", "qty", "note"?, "kind"?, "rarity"?, "slot"?, "stats"?, "carry"? }], "money"?: <base units> }
//
// An item's `carry` (whole 1..500, left out when 0) is the carry capacity the reader set on it (a Traveler's Slingbag); files from before it still load.
//
// `parseCharacterFile` checks a file with the RPG's own limits (the Character and Skills fields, the inventory's name and note lengths)
// and hands back a clean copy: unknown keys are dropped, text is one line, nothing is kept that was not asked for. A bad file is
// `{ ok: false, message }` in plain words; nothing is read from it beyond that. Never throws.
// Public face: re-exports its parts.

export { CHAR_FILE, CHAR_VERSION, FILE_LIMITS } from './charfile-parts/limits.js';
export { buildCharacterFile, fileText, fileNameOf } from './charfile-parts/build.js';
export { parseCharacterFile } from './charfile-parts/parse.js';
export { itemsForFile } from './charfile-parts/items.js';
export { itemLine, skillLine, moneyText, thingsWord } from './charfile-parts/lines.js';
