// Story Director v2, chronicle part: story-day clock helpers and constants. Pure.

import { isInt } from './types.js';

export const DAY_MINUTES = 1440;

// Receipts that set the clock (module story-director, `data.minutes`; `director.clock` is the reader's own edit of it).
// `director.advance` called by another module's command has no receipt of its own; the time part's settle before the
// next reply sets the clock right again.
const CLOCK_TYPES = new Set(['capture.time', 'director.seed', 'director.clock', 'time.settle', 'director.advance']);

/** The story day of `minutes` (whole days since the calendar's start). */
export const dayOf = minutes => Math.floor(minutes / DAY_MINUTES);

export const clockSet = receipt => CLOCK_TYPES.has(receipt.type) && (receipt.module === undefined || receipt.module === 'story-director') && isInt(receipt.data?.minutes);
