// The focused relationship pass: who in the current exchange needs a relationship decision, the
// isolated evaluator request for them (batches of four), and applying its decisions after the merge.
// (cleanup step 10) Moved out of index.js unchanged; the one host read (the chat's dossiers, for
// matching a returned row by name) is passed in by the caller.
// Public face: re-exports its parts.
export { transcriptMentionsNpcRecord, currentExchangeRelationshipRelevant, rawScanMatchesExisting, hasCompletePrimaryRelationshipDecision } from './relationship-pass-parts/targets.js';
export { runFocusedRelationshipPass } from './relationship-pass-parts/run.js';
export { suppressPrimaryRelationshipForFocusedDecisions, stampNpcChanges, applyFocusedRelationshipDecisions } from './relationship-pass-parts/apply.js';
