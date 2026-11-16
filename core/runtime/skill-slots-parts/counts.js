// The slot counts of a Skills block: the most, the starting number, the level step, and how many a level has.
export const SKILL_SLOTS_MAX = 8;
export const SKILL_SLOTS_BASE = 5;
export const SKILL_SLOTS_EVERY = 20;
export const skillSlots = level => Math.min(SKILL_SLOTS_MAX, SKILL_SLOTS_BASE + Math.floor((Number.isFinite(level) ? Math.max(0, level) : 0) / SKILL_SLOTS_EVERY));
