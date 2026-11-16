/* NPC State Delta profile development diagnostics: the per-scan profile, appearance, secondary-profile
   and birthday receipts the merge records, plus profile evidence/application markers. The ledger model,
   observation and readiness parts live in core-profile-development-*.js and are re-exported here unchanged;
   this root path keeps every public export. A pure part of core.js (same owner); never imports core.js.
   Public face: re-exports its parts. */
export {
    PROFILE_DEVELOPMENT_READY_COUNT,
    PROFILE_DEVELOPMENT_FIELDS,
    profileDevelopmentText,
    profileDevelopmentEvidence,
    emptyProfileDevelopment,
    resetProfileDevelopment,
    rebaseProfileDevelopment,
    profileDevelopmentForNpc,
} from './core-profile-development-ledger.js';
export {
    profileDevelopmentProvenanceReady,
    durableUpdateForNpc,
    appearanceUpdateForNpc,
    prepareProfileDevelopmentState,
} from './core-profile-development-readiness.js';
export { clearProfileEvidence, markProfileApplied } from './core-profile-development-parts/profile-markers.js';
export { recordProfileDevelopmentDiagnostic } from './core-profile-development-parts/development-diagnostic.js';
export { recordAppearanceDiagnostic } from './core-profile-development-parts/appearance-diagnostic.js';
export { recordSecondaryProfileDiagnostics } from './core-profile-development-parts/secondary-diagnostics.js';
export { recordBirthdayDiagnostic } from './core-profile-development-parts/birthday-diagnostic.js';
