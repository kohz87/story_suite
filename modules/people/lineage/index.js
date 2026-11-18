// NPC State's message lineage: each message's fingerprint, a chat's lineage, a message's chained key and where two lineages part.
// They name replies for the scan marks, memory facts and the stale-chat check; nothing here records or restores state.
// Public face: re-exports its parts.

export { fingerprintMessage, chatLineage } from './fingerprint.js';
export { BRANCH_LINEAGE_VERSION, lineageCheckpointKey } from './lineage-keys.js';
export { firstLineageDivergence } from './lineage-compare.js';
