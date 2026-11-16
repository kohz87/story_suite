// Story Suite v2: the bare blocks of a reply, outside the hidden comment and closed reasoning.

import { replacePairs, blank } from './pairs.js';
import { hiddenPairs } from './marker.js';
import { findBlocks } from './find.js';
import { maskReasoning } from './reasoning.js';

// The bare blocks of `mes` (not hidden in Story Suite's comment, not inside closed reasoning), at
// their places in `mes`.
export const bareBlocks = (mes, tag, openAt = -1) => {
    const text = String(mes ?? '');
    return findBlocks(maskReasoning(replacePairs(text, hiddenPairs(text), blank)), tag, openAt);
};
