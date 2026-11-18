/* NPC State's supporting tools core: the one tools dialog (portrait manager, backup/restore, diagnostics) and what it reads. Public face: re-exports its parts. */
export { plain, safeNumber, clampText, escapeHtml } from './tools-core-parts/values.js';
export { toolEvents, boundedAppend, recordToolEvent } from './tools-core-parts/events.js';
export { validatePortraitFile, summarizeDecodedBundle, buildPortablePortraitSettings } from './tools-core-parts/portrait-bundle-data.js';
export { relationshipDiagnosticRows } from './tools-core-parts/relationship-audit.js';
export { api, overlayMountHost, modalTopLayerSupported } from './tools-core-parts/host-api.js';
export { activeChatKey, npcById } from './tools-core-parts/host-chat.js';
export { promptDrafts, draftKey, keepPromptDraft } from './tools-core-parts/prompt-drafts.js';
export { activeOverlay, activeSession, closeOverlay, mountOverlay } from './tools-core-parts/overlay.js';
export { portraitTargetCurrent, currentSessionIs, makeSession, setBusy } from './tools-core-parts/session.js';
export { flushDurably } from './tools-core-parts/flush.js';
