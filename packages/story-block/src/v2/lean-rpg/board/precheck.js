// The foe pre-check: a short, pure reading of the reader's typed attack before a reply is generated. It asks for the
// enemy groups the message attacks, reads the answer as JSON, and holds those groups to the Foes block's rules. It
// plans no dice and writes nothing; the caller records accepted groups as an opening and the board plays it.
// Public face: re-exports its parts.
export { namedInMessage } from './precheck-parts/shared-words.js';
export { looksLikeAttack } from './precheck-parts/attack-words.js';
export { PRECHECK_LIMITS, PREVIOUS_CHARS, precheckPrompt } from './precheck-parts/prompt.js';
export { parsePrecheck } from './precheck-parts/parse.js';
export { vetGroups } from './precheck-parts/vet.js';
