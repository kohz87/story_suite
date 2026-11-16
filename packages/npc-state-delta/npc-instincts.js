/* NPC State Delta pull core: the Belonging, Closure and Awe signal readers, the per-NPC instinct values and the top pressure pick. Pure: no host, storage, clock or DOM access; every input is passed in and never mutated. */
// Public face: re-exports its parts.

export { INSTINCT_KINDS, INSTINCT_KEYS, NEW_MEMBER_DAYS, CLOSURE_MIN_DAYS } from './npc-instincts-parts/kinds.js';
export { samePlace } from './npc-instincts-parts/shared-input.js';
export { closureScore, readBelonging, readClosure, readAwe } from './npc-instincts-parts/readers.js';
export { readInstincts } from './npc-instincts-parts/pull.js';
export { PLACES_MAX, THREADS_MAX, stepPull } from './npc-instincts-parts/step.js';
