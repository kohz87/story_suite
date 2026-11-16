// Replay rule (h): an anchored set. A count a command sets to a value that depends on the value before it (a clock face: "9:30 pm" is
// today's 9:30 pm, so it moves with the day) is stored as a `replace` with `was` (the value before), `period` (a whole-number size,
// a day's 1440 minutes) and `roll` ('same' | 'after'). Pure; the one place the arithmetic lives (commands/transact.js writes the mark,
// ops/rebase.js applies it).

/** The marks a command may ask for: `same` (never below the value before it) and `after` (always after it). */
export const ROLLS = new Set(['same', 'after']);

/** Whether `op` carries a well-formed anchored mark (a numeric `value` and `was`, a whole-number `period` of 1 or more, a known `roll`). */
export function isAnchored(op) {
    return op?.op === 'replace' && Number.isSafeInteger(op.value) && Number.isSafeInteger(op.was) && Number.isSafeInteger(op.period) && op.period > 0 && ROLLS.has(op.roll);
}

/**
 * What an anchored op `{ value, was, period, roll }` comes to when the count now holds `now` instead of `was`. `now === was`: the value as
 * stored. Otherwise the op keeps its offset in whole periods from `was` (value + period × (⌊now/period⌋ − ⌊was/period⌋)), then `same`
 * never lands below `now` (it stays at `now`) and `after` that is not after `now` goes one more period.
 */
export function anchoredValue({ value, was, period, roll }, now) {
    if (now === was) return value;
    const moved = value + period * (Math.floor(now / period) - Math.floor(was / period));
    if (roll === 'same') return Math.max(moved, now);
    return moved > now ? moved : moved + period;
}
