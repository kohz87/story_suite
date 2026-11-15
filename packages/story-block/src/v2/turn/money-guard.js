// The money guard: a `+ coin` line (or a money-named `+ item`) that pays what an earlier reply already paid from the same source, or
// is far above the purse, still applies but adds a warning to the Problems list. It reads receipts only (this reply's lines so far and
// the stored receipts of the few replies before) and writes nothing, so replay, rebuild and live agree and no line is ever blocked.
// Public face: re-exports its parts.

export { GUARD_REPLIES, earlierReceipts } from './money-guard-parts/receipts.js';
export { sourceOf, paidBy, gainedBy } from './money-guard-parts/payments.js';
export { FAR_TIMES, FAR_MIN, moneyWarning } from './money-guard-parts/warning.js';
