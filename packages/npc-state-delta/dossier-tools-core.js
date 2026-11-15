/* NPC State Delta supporting tools: portrait manager, native data transfer, and diagnostics. Public face: re-exports its parts. */
export { plain, safeNumber, clampText, escapeHtml } from './dossier-tools-core-parts/values.js';
export { toolEvents, boundedAppend, recordToolEvent } from './dossier-tools-core-parts/events.js';
export { validatePortraitFile, summarizeDecodedBundle, buildPortablePortraitSettings } from './dossier-tools-core-parts/portrait-bundle-data.js';
export { relationshipDiagnosticRows } from './dossier-tools-core-parts/relationship-audit.js';
export { api, uiRoot, overlayMountHost, modalTopLayerSupported } from './dossier-tools-core-parts/host-api.js';
export { activeChatKey, npcById, selectedNpcId, stage1Refresh } from './dossier-tools-core-parts/host-chat.js';
export { promptDrafts, draftKey, keepPromptDraft } from './dossier-tools-core-parts/prompt-drafts.js';
export { activeOverlay, activeSession, closeOverlay, mountOverlay } from './dossier-tools-core-parts/overlay.js';
export { portraitTargetCurrent, currentSessionIs, makeSession, setBusy } from './dossier-tools-core-parts/session.js';
export { flushDurably } from './dossier-tools-core-parts/flush.js';
