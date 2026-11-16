// Story Director v2, tracker part (domain): the step trail's size limits, key rule and order, shared by its writer and its validator.

import { REPLY_KEY, entryOrder } from '../../reply-keys.js';

/** Entries the writer keeps (capture-parts/step-trail.js), the oldest going first. */
export const STEP_KEPT = 400;

/**
 * The most the validator lets the map hold. Replay can hold more than the live cap: a Re-read of an edited
 * reply may add more entries than it did the first time, while a later reply's stored prune of a key that is
 * gone is skipped and its adds still go in (the same headroom as the problems list).
 */
export const STEP_CEILING = 2 * STEP_KEPT;

/** A step's key: the shared reply key (`<sid>.<n>`, `<sid>:<receipt id>.<n>`, or an older `<rev>.<n>` / `r<rev>.<n>`; reply-keys.js). */
export const STEP_KEY = REPLY_KEY;

/**
 * The map's keys in story order. By the writing reply's turn (`turn`, `director.turn.n`) first: stored values never move, so a
 * middle delete keeps them in order. Within a turn, the one placed earlier in the chat (`place`, the carrier index when written: a
 * later reply's stored place is never below the Re-read one's) goes first (two replies share a turn only when a Re-read gives
 * Director lines to a reply that had none), then a reply's own steps by their number (reply-keys.js entryOrder).
 */
const order = entryOrder(step => [step?.turn, step?.place]);
export const stepOrder = map => Object.entries(map).sort(order).map(([key]) => key);
