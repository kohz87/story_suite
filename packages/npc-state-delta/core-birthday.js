/* NPC State Delta birthday, absence and change-marker helpers: NPC-owned sentences, absence and birthday-claim detection,
   birthday grounding and the deterministic rollover, the per-field change markers (with storyDayFromText) and the calendar
   reference and NPC projection the prompt builders use. A pure part of core.js (same owner, moved without change); core.js
   re-exports every name it exported before. Never imports core.js. Public face: re-exports its parts. */

export { npcOwnedSentences } from './core-birthday-parts/owned-text.js';
export { npcCurrentlyAbsentInText } from './core-birthday-parts/absence.js';
export { birthdayUpdateGrounded } from './core-birthday-parts/birthday-claims.js';
export { withAppearanceDerivedApparentAge, calendarNpcProjection } from './core-birthday-parts/apparent-age.js';
export { birthdayUpdateRow, birthdayPromptSource, calendarReference } from './core-birthday-parts/birthday-source.js';
export { normalizeFieldChanges, normalizeFieldChangeDays, normalizeFieldChangeMessages } from './core-birthday-parts/field-change-normalize.js';
export { stampFieldChanges, stampChangedFields } from './core-birthday-parts/field-change-stamp.js';
export { exactStoredAge, sameCalendarBirthday, applyDeterministicBirthdayRollover } from './core-birthday-parts/rollover.js';
