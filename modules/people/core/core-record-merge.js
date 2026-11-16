/* NPC State Delta list/field merge helpers: label/place matching, list and Important Memory merging, and durable-text
   acceptance shared by scan and profile updates. Split from core-record.js without change; core-record.js re-exports
   every name it exported before. Public face: re-exports its parts. */
export { scanLabelsMatch, candidateMatches, mergeLists } from './core-record-merge-parts/labels.js';
export { sameReplyRetelling, mergeImportantMemories } from './core-record-merge-parts/memories.js';
export { PROFILE_UPDATE_TEXT_FIELDS, durableTextAccepted } from './core-record-merge-parts/durable-text.js';
export { incomingCustomFields, incomingKeyRelationships } from './core-record-merge-parts/incoming.js';
