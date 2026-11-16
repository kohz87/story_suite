// Names: the bar stage words and the word a value stands for.

import { spreadWord } from '../blocks.js';

/** Stage words, full → empty. Field values are the stage index (0 = empty) so a meter can draw them. */
export const STAGES = Object.freeze({
    health: Object.freeze(['Down', 'Badly wounded', 'Wounded', 'Hurt', 'Scratched', 'Unhurt']),
    mana: Object.freeze(['Empty', 'Drained', 'Low', 'Steady', 'Fresh']),
    stamina: Object.freeze(['Empty', 'Spent', 'Tired', 'Winded', 'Fresh']),
});

/**
 * The stage word of a bar that holds `value` blocks of `size` (the Standard formula): the first word for none, the last for a full bar, every other
 * count the nearest word in between (blocks.js spreadWord, which the Party tab and the tail use too, so the sheet text, the cue and the story
 * all say the same word). `words` is one of STAGES.
 */
export const stageWord = (words, value, size) => spreadWord(words, Number.isFinite(value) ? Math.trunc(value) : 0, size);
