// Recognises only explicit attacks on a standing, already known foe.
// Uncertain wording goes on with the normal send (no planner now) instead of holding the reader's message.
// Public face: re-exports its parts.

export { ATTACK, WEAPON } from './action-gate-parts/attack-words.js';
export { findAttacks, findAttack } from './action-gate-parts/phrasal.js';
export { READER_SUBJECT, ownSubjectOk } from './action-gate-parts/reader-subject.js';
export { knownFoeAction } from './action-gate-parts/known-foe.js';
