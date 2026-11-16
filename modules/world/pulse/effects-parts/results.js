// Reads the recorded pulse results from the director slot.

import { slotValue } from '../../../rpg/slot.js';
import { isRecord } from './shared-guards.js';

export const RESULTS_MAX = 6;

/** The recorded results, oldest first. */
export const resultsOf = director => { const value = slotValue(director?.pulse); return Array.isArray(value?.results) ? value.results.filter(isRecord) : []; };
