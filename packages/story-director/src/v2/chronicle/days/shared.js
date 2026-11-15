// Story Director v2, chronicle part: shared day-digest constants and text helpers. Pure.
// Public face: re-exports its parts.

export { DIGEST_FEATURE, DIGEST, DAY_MINUTES, SETTLE } from '../days-parts/digest-constants.js';
export { DIGEST_DEFAULTS, FULL_MAX, KEEP_MAX } from '../days-parts/digest-limits.js';
export { FULL_CEILING, KEEP_CEILING, FOLD_AT, FOLLOW_MAX } from '../days-parts/digest-ceilings.js';
export { MAX_HAPPENED, MAX_PLACES, MAX_QUESTS, MAX_NPCS } from '../days-parts/digest-caps.js';
export { MAX_WORLD, MAX_ITEM, MAX_LINE, MAX_DATE } from '../days-parts/text-caps.js';
export { MAX_NAME, MAX_MET, MAX_WHO, ENTRY_HAPPENED } from '../days-parts/entry-caps.js';
export { QUEST_LOG_KEPT, QUEST_LOG_TEXT, ENTRY_KEY } from '../days-parts/log-constants.js';
export { isInt, isRecord, text, codePoints } from '../days-parts/shared-values.js';
export { flat, cut, agoText, dayOf } from '../days-parts/shared-text.js';
export { PLANNED_TYPES, quiet, TOLD_ELSEWHERE, ECHO } from '../days-parts/receipt-filters.js';
export { PRESENT_TYPES, SCENE_TYPES, DM_TYPES, PRESENCE_TEXT } from '../days-parts/receipt-scene.js';
export { BOOKKEEPING_TYPES, isBookkeeping, receiptOf, clockSet } from '../days-parts/receipt-classify.js';
