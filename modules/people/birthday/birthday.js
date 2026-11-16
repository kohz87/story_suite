/* NPC State Delta deterministic birthday continuity policy. Public face: re-exports its parts. */
export { normalizeBirthDate, formatBirthDate, birthDatePrecision } from './birthday-parts/date.js';
export { deterministicBirthday, deriveBirthDateFromAge } from './birthday-parts/derive.js';
export { normalizeBirthDateState, normalizeScanBirthday } from './birthday-parts/scan-input.js';
export { normalizeNpcBirthday, effectiveChronologicalAge, reanchorDerivedBirthYearFromAge } from './birthday-parts/normalize.js';
export { PACK_BIRTHDAY_REASON, applyNpcBirthdayUpdate, mergeNpcBirthdayKnowledge } from './birthday-parts/update.js';
export { birthdayEvidenceInText, birthdayPromptRule, BIRTHDAY_PROMPT_RULE, birthdayCaptureRule } from './birthday-parts/prompt.js';
