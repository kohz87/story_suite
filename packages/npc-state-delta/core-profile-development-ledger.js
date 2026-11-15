/* Personality/Speech development ledger model: field config, bounded evidence parsing, concept and
   ledger normalization, reset/rebase and the per-NPC ledger accessor. A pure part of
   core-profile-development.js (same owner, moved without change); the root file keeps the public
   facade and re-exports every public name it exported before. Never imports core-profile-development.js.
   Public face: re-exports its parts. */
export { PROFILE_DEVELOPMENT_CONCEPT_LIMIT, PROFILE_DEVELOPMENT_OBSERVATION_LIMIT, PROFILE_DEVELOPMENT_READY_COUNT, PROFILE_DEVELOPMENT_MIN_SPAN } from './core-profile-development-ledger-parts/limits.js';
export { PERSONALITY_SPREAD_READY_COUNT, DEVELOPMENT_SPREAD_MIN_DAYS, PERSONALITY_SPREAD_MIN_MESSAGES, PERSONALITY_SPREAD_MIN_TURNS } from './core-profile-development-ledger-parts/spread.js';
export { PROFILE_DEVELOPMENT_FIELDS } from './core-profile-development-ledger-parts/fields.js';
export { profileDevelopmentText, profileDevelopmentTurn, profileDevelopmentSourceMessageId } from './core-profile-development-ledger-parts/values.js';
export { profileDevelopmentEvidence, parseProfileDevelopmentEvidence } from './core-profile-development-ledger-parts/evidence.js';
export { normalizeProfileDevelopmentConcept } from './core-profile-development-ledger-parts/concept.js';
export { emptyProfileDevelopment, resetProfileDevelopment, rebaseProfileDevelopment, profileDevelopmentForNpc } from './core-profile-development-ledger-parts/ledger.js';
