// Story Director v2, the retry ledger of the new policy writers (contract §3 P23/P24): every writer takes `write:RecordId`, allocated and
// persisted by the host before dispatch, and its owner keeps `{ fingerprint, result }` for the normalized command type and payload
// without `write`. The same write with the same fingerprint returns the saved result before any stale check; the same write with another
// meaning is a CONFLICT. The ledger lives in its owner's domain (`checks.writes`, `atlas.writes`) and is left out of every policy hash.
// Bounded: the newest LIMIT entries are kept (the host retries a write soon after it, never long after). Pure.
// Public face: re-exports its parts.

export { WRITE_ID, WRITES_LIMIT } from './writes-parts/shared-ledger.js';
export { fingerprintOf, retryOf, remember } from './writes-parts/retry.js';
export { ledgerProblems } from './writes-parts/problems.js';
export { idFrom } from './writes-parts/ids.js';
