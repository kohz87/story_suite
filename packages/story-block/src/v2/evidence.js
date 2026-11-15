// Story Suite v2: proof and evidence (docs/v2/EVIDENCE.md, contract §6 "Proof submission" and "story.evidence").
//
// A module that owns a kind of proof (Story Director: visit, acceptance, event) calls `ctx.proof({ kind, payload, parents? })` inside a command. The host checks who is asking, what
// the payload is and what the reader really said, stamps the id, the Source and the payload hash, keeps the
// proof on the span of the block the command makes (`span.evidence`) and pins it in the state
// (`meta.proofs[id]`, written by the same ops as the block). The pin is what makes a proof ACTIVE: a block
// that does not apply, a reply that was deleted or a swipe that is not shown leave no pin, so the proof is
// not there. `story.evidence` shows a proof only while its bytes still match its pin, its owner and kind
// still match the table below, its payload is still closed and well formed, and every parent is visible too.
//
// This file is pure: it reads no chat and no registry. The command bus (commands.js) calls `submitProof`, the
// store (store.js) calls `recordEntries` and `evidenceProblem`, and `createEvidenceQuery` is the query the
// core module registers.
//
// Public face: re-exports its parts.

export { operationKey, spanOperationKey } from './evidence-parts/operation-key.js';
export { takenAfter, nextOccurrence, allocator } from './evidence-parts/occurrence.js';
export { reusePlan, replacedProofs } from './evidence-parts/reuse.js';

export { OWNERS, KINDS, STATS, LIMITS, occurrenceOf } from './evidence/constants.js';
export { payloadProblem, payloadKey, sentences, intentProblem } from './evidence/payloads.js';
export { proofProblem, pinOf, evidenceDigest, receiptEvidence, proofPins, pinOps, reachesBranch, touchesProof, proofWriteProblem, opShapeProblem, evidenceProblem } from './evidence/stored.js';
export { recordEntries, merged, visibleProofs, createEvidenceQuery } from './evidence/visible.js';
export { newRoot, submitProof } from './evidence/submit.js';
