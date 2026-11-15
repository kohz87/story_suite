// NPC State Delta's timeline participant (track B6; Story Block docs/v2/TIMELINE.md): see participant.js. New files only; Delta's own
// modules, its prompts and its storage are untouched. The registration in src/storysuite-v2.js (`participant`, the `npc.identity` query,
// the runtime port) is Delta's own wiring (docs/dev/storysuite-participant.md).
// Public face: re-exports its parts.

export { MODULE_ID, confirmedDeath, createParticipant } from './index-parts/participant-face.js';
export { PARTICIPANT_SCHEMA, buildCheckpoint, checkpointIdOf, checkpointProblem } from './index-parts/checkpoint-face.js';
export { NP_ID, hydrateIdentity, resolveIdentity } from './index-parts/identity-face.js';
export { LINEAGE_ID, cleanTimeline, storedTimeline, timelineOf } from './index-parts/timeline-state-face.js';
export { installGuard, mintLineage, restoredState, restoreNoteText } from './index-parts/timeline-restore-face.js';
export { changeAt, selectionBehind, selectionMaxBehind } from './index-parts/timeline-selection-face.js';
export { fileVault, memoryVault } from './index-parts/vault-face.js';
