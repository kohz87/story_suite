/* Manual Important Bond edits, mirrored updates and repair.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { relationshipSubjectCandidate, relationshipCounterpartId, relationshipTargetsNpc, explicitReverseRelationship } from './social-manual-parts/bond-lookup.js';
export { removeMirroredRelationship, replaceManualRelationshipEdge, applyManualKeyRelationshipEdit, syncMirroredRelationship } from './social-manual-parts/manual-edit.js';
export { speciesWords, describesNpc, repairMirroredKeyRelationships, resolveConflictingKinship } from './social-manual-parts/mirror-repair.js';
