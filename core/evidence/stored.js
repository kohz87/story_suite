// Story Suite v2 evidence, stored part: whether a stored proof is whole and owned, its pin, the pins written with a block's
// ops and the write checks on the proof record (proofWriteProblem, evidenceProblem). Pure. evidence.js keeps the public path.
// Public face: re-exports its parts.

export { proofProblem, pinOf, evidenceDigest, receiptEvidence } from './stored-parts/proof.js';
export { pinsOf, proofPins, pinOps } from './stored-parts/pins.js';
export { reachesBranch, touchesProof, proofWriteProblem } from './stored-parts/branch.js';
export { opShapeProblem, evidenceProblem } from './stored-parts/span-check.js';
