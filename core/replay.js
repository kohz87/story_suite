// Story Suite v2: the pure pieces of guarded replay (docs/v2/REPLAY.md, contract §4 and §6), shared by the
// command bus (commands.js), the store (store.js) and the tests. Nothing here reads the chat or the registry.
//
// * Hash: SHA-256 of normalized JSON (sorted keys, array order kept), as 64 lowercase hex characters. The
//   contract's inputHash / prefixHash / payloadHash are all this; it is synchronous because replay is.
// * Canonical ids: `<prefix>_<8 base36>` worked out from a stored key (the shipped `sw_<12 hex>` record IDs
//   are kept byte for byte; only the canonical pair, swipe key and evidence ID are derived from them), with
//   a salt when another record already holds the result.
// * The shapes a guarded block's span carries (Guard, Source, the span itself), checked in one place so the
//   bus, the store and a hand-edited chat file are all held to the same rules.
// * Claim extraction: the claims a block's ops add (`/meta/claims/<key>`), so they can be listed on the span
//   and applied or skipped together with the block.
//
// The ID shapes are exactly check.js's RECORD_ID; nothing here widens a regex.

// Public face: re-exports its parts.

export { sha256 } from './replay-parts/sha256.js';
export { canonicalJson, hashJson, isPlainJson } from './replay-parts/canonical.js';
export { isHash, isRecordId, idFromHash } from './replay-parts/id-forms.js';
export { blockIdOf, deriveId } from './replay-parts/ids.js';
export { GENESIS_EPOCH, epochOf } from './replay-parts/epoch.js';
export { sourceProblem, guardProblem } from './replay-parts/source-guard.js';
export { isMetaSpan, cursorProblem, spanProblem } from './replay-parts/spans.js';
export { claimKeys } from './replay-parts/claims.js';
export { replayInputsOf, REPLAY_BOOKKEEPING } from './replay-parts/inputs.js';
