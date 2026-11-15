// Story Suite v2 evidence, constants part: the owner of each proof kind, the stat names, the structural caps, the stored
// proof's key list, and the small readers every part shares (isObject, utf8, whole, occurrenceOf). Pure: no state is read.
// evidence.js keeps the public path of each export.
//
// Public face: re-exports its parts.

export { isObject, utf8, whole, occurrenceOf } from './constants-parts/readers.js';
export { OWNERS, KINDS, STATS } from './constants-parts/owners.js';
export { LIMITS, PROOF_KEYS, CONTROL } from './constants-parts/limits.js';
