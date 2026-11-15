// Story Director v2, journal: tells NPC upkeep receipts (mood, drives, a look fixed) from events of the day.

// NPC State Delta's per-reply upkeep receipts (mood, drives, taste, a flag or a look fixed, a meeting): not events of the day, shown or not by the screen only.
const UPKEEP_TYPES = new Set(['npc.mood', 'npc.drives', 'npc.taste', 'npc.flag', 'npc.meet']);
export const UPKEEP_TEXT = /^[^:]{1,80}: (?:nothing moved|meters started|nothing changed)\b/i;
export const isUpkeep = (type, text) => UPKEEP_TYPES.has(type) || UPKEEP_TEXT.test(String(text ?? '').trim());
