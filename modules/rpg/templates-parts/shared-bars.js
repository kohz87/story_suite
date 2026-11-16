// The bar builders of the Standard formula's blocks: the stage-word field, a bar, a hidden size and a stage word's blocks.
import { names } from './shared-names.js';
import { int } from './shared-fields.js';

// Blocks for a stage word, in a bar of `size` blocks: round(word index × size / (words − 1)), half up; the first word is 0 and the last the full bar.
export const blocksOf = (word, size, count) => ['floorDiv', ['add', ['mul', word, size], Math.floor((count - 1) / 2)], count - 1];
export const stageLabel = words => ({ type: 'int', min: 0, max: words.length - 1, names: names(words) });
export const bar = (label, max, blocks, value) => int(label, 0, max, value, { blocks });
export const hiddenSize = (label, max, value) => int(label, 0, max, value, { prompt: false, edit: false });
