// NPC State Delta core facade: the one import point for core mechanics, calendar, birthday and scan/prompt entry points. Public face: re-exports its parts.
export * from './core-mechanics.js';
export * from '../appearance/appearance.js';
export * from './terminal-lifecycle.js';
export * from './roster-count.js';
export * from '../legacy/calendar.js';

export {
    BIRTHDAY_PROMPT_RULE,
    birthDatePrecision,
    deriveBirthDateFromAge,
    deterministicBirthday,
    formatBirthDate,
    normalizeBirthDate,
    normalizeBirthDateState,
} from '../birthday/birthday.js';
export { npcOwnedSentences, npcCurrentlyAbsentInText, normalizeFieldChanges, normalizeFieldChangeDays, normalizeFieldChangeMessages, stampChangedFields } from './core-birthday.js';
export { storyDayFromText, storyDateKey, calendarAgeStats, refreshCalendarAges } from './core-parts/calendar-days.js';
export { applyStaleNpcLifecycle } from './core-parts/stale-lifecycle.js';
export { normalizeNpcRecord, normalizeScanNpc, setNpcArchived, applyNpcStateCommand } from './core-parts/npc-records.js';
export { mergeScanResult } from './core-parts/scan-merge.js';
export { buildNpcPortraitPrompts, buildInjection } from './core-parts/projected-reads.js';
export { LEVEL_FIELD_RULE } from './core-parts/shared-custom-field-rule.js';
export { buildScannerPrompt, buildBackfillPrompt, buildDossierImportPrompt, buildProfileRefreshPrompt } from './core-parts/scanner-prompts.js';
export { NARRATION_CAPTURE_CONTEXT_MARKER, NARRATION_CAPTURE_TAIL_LEAD, buildNarrationCapturePrompt, buildNarrationCaptureParts } from './core-parts/narration-capture.js';

// NPC State Delta application version. Persisted bundle, branch, and data schemas are versioned independently.
export const NPC_STATE_VERSION = '1.18.0';
