/* NPC State Delta scan helpers (role: scan-helpers). Stateless readers of the open chat and small helpers the scan, injection, editor and mutation code share:
   the latest message and reply positions, the lineage key of a message, whether a chat moved between two lineages, the relationship number clamp,
   a manual edit's change stamp, the scan and dossier-scan indicators, the capture setting, and the user-dismissed suppression clear. Nothing here
   holds state. Bodies are moved from index.js without change. Public face: re-exports its parts. */

export { replayScope, inReplay, awayFromReplay } from './runtime-scan-helpers-parts/replay-state.js';
export { chatContext, clockNow, notify } from './runtime-scan-helpers-parts/replay-reads.js';
export { scopedAdapter } from './runtime-scan-helpers-parts/scoped-adapter.js';
export { setNpcDossierScanIndicator, setNpcChatRefreshIndicator, setScanIndicator } from './runtime-scan-helpers-parts/scan-indicators.js';
export { stampManualEdit, lineageMoved, clearUserDismissedSuppression } from './runtime-scan-helpers-parts/state-rules.js';
export { narrationCaptureEnabled, relationshipNumber, worth } from './runtime-scan-helpers-parts/value-rules.js';
export { latestReplyIndex, markStands, latestMessageId, currentLineageKeyForMessage } from './runtime-scan-helpers-parts/chat-positions.js';
export { relationshipChanges, refusedLooks, scanMoodNumbers } from './runtime-scan-helpers-parts/scan-results.js';
