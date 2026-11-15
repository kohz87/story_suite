/* NPC State Delta: pure scan/backfill eligibility helpers.
   Public face: re-exports its parts. */

export { AUTOMATIC_BACKFILL_QUEUE_VERSION, AUTOMATIC_MISSED_PARTICIPANT_REPAIR_LIMIT, AUTOMATIC_BACKFILL_REASONS, normalizeAutomaticBackfillRequest } from './scan-context-parts/backfill-queue.js';
export { AUTO_SCAN_EVERY_WITHOUT_EVERY_REPLY, autoScanDue } from './scan-context-parts/cadence.js';
export { replyMayChangeDossiers } from './scan-context-parts/reply-change.js';
export { npcParticipatesInExchange } from './scan-context-parts/participation.js';
export { backfillNeedsRequest, automaticBackfillStillRelevant } from './scan-context-parts/backfill-relevance.js';
export { READ_AHEAD_MAX, readAheadOf, replyScanned, settleScan } from './scan-context-parts/read-marker.js';
export { storyTextsForAdmission } from './scan-context-parts/admission.js';
