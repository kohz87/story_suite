// NPC notes, tastes: the `taste` line's record (one JSON text leaf per NPC, bounded), the fixed rule (first mention wins; a change
// needs why:), the deterministic mirror check (a taste that echoes the user's last message is kept and marked, never refused) and the
// wording of the Problem, the next-reply cue and the optional tail line. Pure; never imports npc-meters.js.
// Public face: re-exports its parts.
export { TASTE_LIMITS, TASTE_RULE } from './npc-notes-tastes-parts/shared-limits.js';
export { tasteWords, tasteKey, contentWords } from './npc-notes-tastes-parts/words.js';
export { readTastes, tastesText } from './npc-notes-tastes-parts/record.js';
export { tasteRuleFor, markTasteResult } from './npc-notes-tastes-parts/rule.js';
export { mirrorCheck, mirrorWording } from './npc-notes-tastes-parts/mirror.js';
export { addTaste, mergeRefreshTastes } from './npc-notes-tastes-parts/capture.js';
export { tasteTail } from './npc-notes-tastes-parts/tail.js';
