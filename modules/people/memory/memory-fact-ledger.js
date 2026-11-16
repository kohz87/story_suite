// Memory facts (design MEMDESIGN2 §3): the per-NPC `memoryFacts` sidecar and its bounded suppression ledger.
//   { v: 1, entries: { [key]: { t: normalized text, r: reply, s: source ref, rev: source revision, k: kind, c: 'M'|'A'|'O', p: payload,
//                              i: identity hash, d?: story date, pend?: 1, att?: n } },
//     ledger: { floor: reply boundary, keys: [[key, boundary, disposition, identity]] } }
// Dispositions: k kept, e evicted by retention, x deleted/edited by the reader, l locked, c display collision, o per-reply overflow, q quarantined.
// The ledger holds at most LEDGER_CAP keys per NPC (whole boundary groups pruned oldest first, `floor` advancing over them), so an old event
// below the floor is never recreated just because its key was pruned. Storage (amendment 2): the cap is 64 (not 256: 256 rows x ~70 B x 60 dossiers would be ~1 MB per snapshot). A full sidecar (64 rows, 5 maximal entries) measured 6.9 KB, so 60 dossiers all full = ~0.41 MB, a fifth of the 2 MB single-checkpoint limit.
// Public face: re-exports its parts.
export { FACT_SLOTS, LEDGER_CAP, PAYLOAD_BYTES, ADMIT_PER_REPLY } from './memory-fact-ledger-parts/limits.js';
export { isFactKey } from './memory-fact-ledger-parts/shared-checks.js';
export { cleanLedger, pruneLedger, ledgerRow } from './memory-fact-ledger-parts/ledger-rows.js';
export { factSeen, withDisposition } from './memory-fact-ledger-parts/ledger-seen.js';
export { normalizeFacts } from './memory-fact-ledger-parts/normalize.js';
