// Story Director v2, chronicle part: name, witness, and entry-item caps for digests. Pure.

import { MAX_HAPPENED } from './digest-caps.js';

export const MAX_NAME = 80;
export const MAX_MET = 8;
// Who was in the scene at a line (its witnesses): at most this many names are kept with it (the [Earlier days] block shows three).
export const MAX_WHO = 6;
// One entry's lists at most (an entry is one reply's part of a day, see entryOf).
export const ENTRY_HAPPENED = MAX_HAPPENED;
