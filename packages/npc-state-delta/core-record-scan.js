/* NPC State Delta scan-row and candidate normalization: normalizeScanNpc, candidate records, admission/promotion and
   candidate matching. Split from core-record.js without change; core-record.js re-exports every name it exported before. Public face: re-exports its parts. */
export { normalizeScanNpc } from './core-record-scan-parts/scan-row.js';
export { normalizeNpcCandidate, candidateRecordMatches, makeNpcCandidate } from './core-record-scan-parts/candidates.js';
export { shouldCreateDossierImmediately, shouldPromoteCandidate } from './core-record-scan-parts/admission.js';
