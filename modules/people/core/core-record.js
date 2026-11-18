/* NPC State Delta record facade: canonical stored-record normalization and lifecycle owners. The implementation is split
   across core-record-shared.js, core-record-scan.js, core-record-custom-fields.js and core-record-merge.js; this module
   keeps its original path and re-exports every public name unchanged. Public face: re-exports its parts. */
export { setNpcArchived, npcMattersForRetention, applyStaleNpcLifecycle } from './core-record-parts/archive.js';
export { normalizeNpcRecord } from './core-record-parts/normalize.js';
export { createNpcRecord } from './core-record-parts/create.js';
export { NPC_ADMISSION_MODES, IMPORTANT_MEMORY_LIMIT, PORTRAIT_SEED_MAX, normalizePortraitSeed, normalizeNpcAdmissionMode, normalizeLifeStateCertainty, CAST_APPEARANCE_WIDE, castAppearanceKept, NPC_CANDIDATE_TTL_TURNS, NPC_CANDIDATE_LIMIT, npcMatchesLabel, normalizeStoredMemories, stripRecordCitations } from './core-record-shared.js';
export { normalizeScanNpc, normalizeNpcCandidate, candidateRecordMatches, makeNpcCandidate, shouldCreateDossierImmediately, shouldPromoteCandidate } from './core-record-scan.js';
export { CUSTOM_FIELD_LIMIT, normalizeCustomFieldNames, normalizeCustomFields, customFieldValues } from './core-record-custom-fields.js';
export { applySheetLevels, sheetLevelOf, withoutSheetLevels } from './core-record-custom-fields.js';
export { PROFILE_UPDATE_TEXT_FIELDS, durableTextAccepted, incomingCustomFields, incomingKeyRelationships, mergeLists, mergeImportantMemories, scanLabelsMatch, candidateMatches } from './core-record-merge.js';
