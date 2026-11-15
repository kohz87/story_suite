// Spreads stage words over a bar's blocks and back.
import { wordsOf } from './schema-reading.js';
import { whole } from './shared-whole.js';

/**
 * The stage word of `value` blocks left in a bar of `size` blocks, from `words` (empty first, full last): 0 is the first word, a full bar the
 * last, anything between the nearest word in between (the first and last are kept for exactly empty and exactly full).
 */
export function spreadIndex(value, size, count) {
    const last = count - 1;
    if (!(size > 0) || value <= 0) return 0;
    if (value >= size) return last;
    return Math.min(last - 1, Math.max(1, Math.floor((2 * value * last + size) / (2 * size))));
}
export const spreadWord = (words, value, size) => words[spreadIndex(value, size, words.length)] ?? '';

/**
 * The blocks a stage word stands for in a bar of `size` blocks: the first word is 0, the last the full bar, and the word at position `index` in
 * between is `index / (words − 1)` of the bar, rounded to the nearest block. (This is the number the Standard templates' kinds work out,
 * written there as `floorDiv(index × size + (words − 1)/2, words − 1)`.)
 */
export const wordToBlocks = (index, size, count) => Math.floor((2 * index * size + (count - 1)) / (2 * (count - 1)));

/** The stage word of `value` blocks left in a bar of `size` blocks, for a bar kind ('health' | 'stamina' | 'mana' | 'foe'): what the sheet text and the views say. */
export const stageText = (bar, value, size) => spreadWord(wordsOf(bar), Math.max(0, whole(value)), size);
