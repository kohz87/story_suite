// Mood axis limits, clamping one axis, and reading a story day.
import { isFiniteNumber } from './shared-checks.js';

export const MOOD_MIN = -3;
export const MOOD_MAX = 3;

/** One axis as a whole number in -3..3. Non-numbers and NaN read as 0; -0 is returned as 0. */
export function clampAxis(value) {
  if (!isFiniteNumber(value)) return 0;
  const n = Math.round(value);
  if (n === 0) return 0;
  return n < MOOD_MIN ? MOOD_MIN : n > MOOD_MAX ? MOOD_MAX : n;
}

/** A story day as a whole number >= 0; anything else reads as day 0. */
export function dayOf(value) {
  return isFiniteNumber(value) && value > 0 ? Math.floor(value) : 0;
}
