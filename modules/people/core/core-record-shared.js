/* NPC State Delta record shared primitives: admission/portrait constants, cast-appearance preservation, appearance canon,
   stored-memory normalization, label matching and scanner-citation stripping. Split from core-record.js without change;
   core-record.js re-exports the names it exported before. Public face: re-exports its parts. Never imports core-record.js, core-mechanics.js or core.js. */
export { NPC_ADMISSION_MODES, normalizeNpcAdmissionMode, NPC_CANDIDATE_TTL_TURNS, NPC_CANDIDATE_LIMIT } from './core-record-shared-parts/admission.js';
export { PORTRAIT_SEED_MAX, normalizePortraitSeed, normalizeLifeStateCertainty } from './core-record-shared-parts/scalars.js';
export { CAST_APPEARANCE_WIDE, castAppearanceKept, normalizeAppearanceCanon } from './core-record-shared-parts/appearance.js';
export { npcMatchesLabel } from './core-record-shared-parts/label.js';
export { IMPORTANT_MEMORY_LIMIT, normalizeStoredMemories, normalizeMemoryStamps, stampMemories } from './core-record-shared-parts/memories.js';
export { stripRecordCitations } from './core-record-shared-parts/citations.js';
