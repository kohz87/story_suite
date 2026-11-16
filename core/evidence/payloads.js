// Story Suite v2 evidence, payloads part: checks that a proof payload is closed and well formed for its kind, its payload
// key, and whether a proof's intent matches what the reader said. Pure. evidence.js keeps the public path of each export.
//
// Public face: re-exports its parts.

export { exactKeys, payloadCheck, payloadProblem } from './payloads-parts/shape.js';
export { payloadKey } from './payloads-parts/key.js';
export { sentences, intentProblem } from './payloads-parts/intent.js';
