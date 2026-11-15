// Memory facts (design MEMDESIGN2 §2, §9): the fallback sentence of each fact kind and its CLOSED sentence grammar. A fact's typed payload
// expands into a small finite set of allowed sentences (the first is the code's fallback); the model may only pick one of them. Nothing
// else (an extra clause, a swapped role, a changed polarity) is accepted, so every claim is checkable. Pure functions.
// Public face: re-exports its parts.
export { FACT_KINDS, MAX_SENTENCE, MAX_LITERAL } from './memory-fact-text-parts/limits.js';
export { AXES } from './memory-fact-text-parts/tables.js';
export { safeLiteral, playerLabel } from './memory-fact-text-parts/literals.js';
export { cleanPayload } from './memory-fact-text-parts/payload.js';
export { productions, fallbackText } from './memory-fact-text-parts/productions.js';
export { validPhrasing } from './memory-fact-text-parts/phrasing.js';
