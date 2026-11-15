// The Standard formula's bars (agreed 1 Nov): a bar is a row of blocks. The stored value counts the blocks left (Health 0..8, Stamina
// 0..7, Mana 0..7 on a character; a foe group's Health 0..8); how many blocks the bar has is worked out from the stats when it is read
// (formula.js `blocksFor`, `foeHealthBlocks`), never stored as the value. A field says it is such a bar with `blocks` on its schema
// ('health' | 'stamina' | 'mana' on a character, 'foe' on a foe slot's `hurtN`); a field without it is a stage field (older blocks) and is read
// exactly as before (party-data.js, read.js, tail.js).
//
// The stage words (Down … Unhurt, Empty … Fresh) are spread over the bar's size: the first and last block are exact (0 blocks is the
// first word, a full bar the last), every other count takes the nearest of the words in between. The story still reads words, never
// numbers, and writes a word: the Standard templates turn the word into blocks for the bar's size with the same rounding (`wordToBlocks`).
// Pure: no DOM, no state, no randomness.
// Public face: re-exports its parts.

export { barOf, scaleOf, wordsOf, statsOfFields } from './blocks-parts/schema-reading.js';
export { spreadIndex, spreadWord, wordToBlocks, stageText } from './blocks-parts/stage-words.js';
export { sizeOf, barReading, characterBars } from './blocks-parts/bar-size.js';
export { barFields, growthOf } from './blocks-parts/growth.js';
