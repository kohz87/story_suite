// Story Director v2, chronicle part: day-digest validator ceilings and folding thresholds. Pure.

import { FULL_MAX, KEEP_MAX } from './digest-limits.js';

// The validator's ceilings: twice the settings' tops, so a replay that brings back an entry a deleted
// reply had dropped is never refused for it (SPEC §2.2 rule a); the next digest drops it again.
export const FULL_CEILING = FULL_MAX * 2;
export const KEEP_CEILING = KEEP_MAX * 2;
/** Entries a day may keep before a note folds them into its own one (a very long day). */
export const FOLD_AT = 200;
/** Entries the written days keep in all, so their digests follow them (newest days first, each day whole). */
export const FOLLOW_MAX = 800;
