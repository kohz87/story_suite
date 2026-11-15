// Head-selection fallback (B group spec 3a): the boundary test shared by the selection plan and the
// fallback chain, the chain itself (matching prefix entries newest first, then the baseline), and the
// read-only walk that verifies candidates before preparing the first usable one. This is only for
// selecting a head. A reader's restore and every save point keep the exact rule and never fall back.
//
// Participant `verify` contract (optional):
//     verify({ checkpoint, hash }) -> { ok: true } | { ok: false, code, message }
// It reads the checkpoint file, checks that its bytes hash to `hash` and that it belongs to this
// chat's lineage, and changes nothing: it does not install, prepare, select, or write state, the
// journal, or the vault. A missing file is SNAPSHOT_UNAVAILABLE; another lineage is CONFLICT. A
// participant with no verify is walked with prepare itself; a prepare that fails changes nothing.
//
// The chain is a pure read of the archive and the current chat. The same journal and chat give the
// same chain, in the same order: there is no clock, randomness, or mutation-time ordering. Ties use
// the archive's sequence, exactly as the selection plan does.
//
// Public face: re-exports its parts.

export { FALLBACK_CODES, canFallback, boundaryMatches } from './selection-fallback-parts/boundary.js';
export { createSelectionFallback } from './selection-fallback-parts/chain.js';
export { settledPlan, fellNotice } from './selection-fallback-parts/settled.js';
