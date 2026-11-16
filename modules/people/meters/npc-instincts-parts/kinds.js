// The three instinct kinds, their short keys and the day counts that open the Belonging and Closure readers.

// Scores are small ints 0..3. A reader that cannot date its signal (no finite story day), or whose
// input is missing or malformed, returns null, so a failed or slow query degrades to "no signal".

export const INSTINCT_KINDS = Object.freeze(['belonging', 'closure', 'awe']);
export const INSTINCT_KEYS = Object.freeze({ belonging: 'belo', closure: 'clos', awe: 'awe' });
export const NEW_MEMBER_DAYS = 2;
export const CLOSURE_MIN_DAYS = 2;
