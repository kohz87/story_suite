/* NPC State Delta Stage 4 continuity facade. Public face: re-exports its parts. */

export { normalizeNpcRecord, normalizeScanNpc, setNpcArchived, applyNpcStateCommand } from './continuity-core-parts/records.js';
export { mergeScanResult } from './continuity-core-parts/scan-merge.js';
export { buildNpcPortraitPrompts, buildInjection } from './continuity-core-parts/portrait-injection.js';
export { buildScannerPrompt, buildBackfillPrompt, buildDossierImportPrompt, buildProfileRefreshPrompt } from './continuity-core-parts/prompts.js';
