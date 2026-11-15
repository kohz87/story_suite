// Story Director v2, chronicle part: validator ceilings for kept day digests. Pure.

import { FULL_MAX, KEEP_MAX } from './defaults.js';

// The validator's ceilings: twice the settings' tops, so a replay that brings back an entry a deleted
// reply had dropped is never refused for it (SPEC §2.2 rule a); the next digest drops it again.
export const FULL_CEILING = FULL_MAX * 2;
export const KEEP_CEILING = KEEP_MAX * 2;
