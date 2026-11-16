// Interpreter 1's closed authoring contract. Studio imports this and check.js directly;
// there is no editor-specific schema. Runtime budgets also belong to this version.
// Public face: re-exports its parts.
export { DATA_MODULES_CAPABILITY, DM_LIMITS, DM_DIAGNOSTICS } from './schema-parts/limits.js';
export { DM_DESCRIPTORS, DM_ENTRY_EFFECTS, DM_BLOCK_BARS } from './schema-parts/descriptors.js';
export { dmObject, dmOwn, dmSlug, dmInt } from './schema-parts/checks.js';
export { dmDefaultTone, dmId } from './schema-parts/tone-id.js';
export { dmNameOf, dmShown, dmValueOfName, dmLabelNames } from './schema-parts/names.js';
export { dmHidden, dmKindWrites, dmKindWritesHidden } from './schema-parts/hidden.js';
export { DM_OLD_ROOM, dmRoom } from './schema-parts/room.js';
