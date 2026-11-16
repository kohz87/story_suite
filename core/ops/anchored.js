// Replay rule (h): an anchored set. A count a command sets to a value that depends on the value before it (a clock face: "9:30 pm" is
// today's 9:30 pm, so it moves with the day) is stored as a `replace` with `was` (the value before), `period` (a whole-number size,
// a day's 1440 minutes) and `roll` ('same' | 'after'), and for a 'same' set the clock stood past, `to` (the face before the clamp). Pure;
// the one place the arithmetic lives (commands/transact.js writes the mark, ops/rebase.js applies it).

/** The marks a command may ask for: `same` (never below the value before it) and `after` (always after it). */
export const ROLLS = new Set(['same', 'after']);

/** Whether `op` carries a well-formed anchored mark (a numeric `value` and `was`, a whole-number `period` of 1 or more, a known `roll`, and a `to` that is a whole number when there is one). */
export function isAnchored(op) {
    return op?.op === 'replace' && Number.isSafeInteger(op.value) && Number.isSafeInteger(op.was) && Number.isSafeInteger(op.period) && op.period > 0 && ROLLS.has(op.roll) && (op.to === undefined || Number.isSafeInteger(op.to));
}

/**
 * What an anchored op `{ value, was, period, roll, to }` comes to when the count now holds `now` instead of `was`. `now === was`: the value
 * as stored. Otherwise the op keeps its offset in whole periods from `was` (target + period × (⌊now/period⌋ − ⌊was/period⌋), the target
 * being `to` when a 'same' set was clamped, else `value`), then `same` never lands below `now` (it stays at `now`) and `after` that is
 * not after `now` goes one more period. So a clamped face lands where a fresh telling of it on `now` would.
 */
export function anchoredValue({ value, was, period, roll, to }, now) {
    if (now === was) return value;
    const shift = period * (Math.floor(now / period) - Math.floor(was / period));
    if (roll === 'same') return Math.max((to ?? value) + shift, now);
    const moved = value + shift;
    return moved > now ? moved : moved + period;
}

/** The op moved onto `now` (its value, `was`, and the unclamped `to` shifted with them). */
export function anchoredMove(op, now) {
    const moved = { ...op, value: anchoredValue(op, now), was: now };
    if (op.to !== undefined) moved.to = op.to + op.period * (Math.floor(now / op.period) - Math.floor(op.was / op.period));
    return moved;
}
