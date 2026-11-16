// Story Suite v2: the hidden comment's marker, its open and close patterns, and finding its pairs.

import { closedPairs } from './pairs.js';

// The HTML comment a captured block is kept in, so SillyTavern shows nothing of it and the
// prompt history can drop it (turn.js). `\b` keeps a longer marker from matching.
export const HIDDEN_MARKER = 'STORY_SUITE_V2';

// The hidden comment's open and its end, found apart (closedPairs): a lazy `<!--…[\s\S]*?-->` tried
// again from every unclosed open costs the square of the text (B-b5b-robust-r2-4).
export const HIDDEN_OPEN = new RegExp(`<!--\\s*${HIDDEN_MARKER}\\b`, 'g');
export const HIDDEN_CLOSE = /-->/g;

export const hiddenPairs = text => closedPairs(text, HIDDEN_OPEN, HIDDEN_CLOSE);
