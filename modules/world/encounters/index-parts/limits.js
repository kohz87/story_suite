// The encounters' sizes: results kept, people seen kept, text lengths, and the weight multipliers.

export const LIMITS = Object.freeze({ results: 6, seen: 48, who: 60, look: 160, id: 60, rows: 64 });
/** A `likelier_if` condition that holds here doubles a row's weight; a `less_if` one halves it (each one that holds). */
export const CONDITION_FACTOR = Object.freeze({ likelier: 2, less: 0.5 });
