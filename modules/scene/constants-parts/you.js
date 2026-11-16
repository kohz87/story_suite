// {{user}}'s look (`~ you`): its character cap, feature name and the parts a look has (position is optional: kneeling, riding, in bed). Pure.

import { CORE_FEATURE } from '../../../core/features.js';

/** What {{user}} wears and their condition (`~ you`): each at most this many code points (cut, an ellipsis in the last place). */
export const YOU_CHARS = 120;
export const YOU_FEATURE = CORE_FEATURE.you;
export const YOU_PARTS = Object.freeze(['rank', 'wearing', 'condition', 'outfit', 'look', 'position']);
/** The two short parts (gear on, B1.4): a lasting outfit and a passing look, each at most this many code points. */
export const YOU_SHORT = Object.freeze(['outfit', 'look']);
export const YOU_SHORT_CHARS = 60;
