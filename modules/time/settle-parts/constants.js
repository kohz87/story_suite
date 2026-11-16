// Story Director v2, part time: the reason words, outcome and claim key a deadline closing uses.

import { LAPSED_REASON, SLIPPED_REASON } from '../lapses.js';

export const DEADLINE_REASON = 'deadline passed';
export const REASONS = Object.freeze({ slipped: SLIPPED_REASON, lapsed: LAPSED_REASON, failed: DEADLINE_REASON });
// How a thread time closed ends (MODULES §C1 outcomes): the time ran out on it.
export const LAPSE_OUTCOME = 'failed';
export const claimKey = id => `lapse:${id}`;
