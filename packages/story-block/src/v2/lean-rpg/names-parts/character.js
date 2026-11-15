// Names: rank and class names, resource uses and the creation budget.

/** What a skill's rank (0–3) and a Soul Class (1–9) are called. */
export const RANK_NAMES = Object.freeze(['Novice', 'Adept', 'Expert', 'Master']);
export const CLASS_NAMES = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']);

/** What a skill spends: its `uses` (a skill whose resource is Empty is rolled without it). */
export const USES = Object.freeze(['stamina', 'mana']);

/**
 * The New character wizard's budget (SPEC_RPG, mockup section 4): every stat starts at `start`, the reader has `budget`
 * points to spend, a stat may go down to `min` to free a point and up to `max` at creation. A character starts with up to
 * `skills` skills, at most `adept` of them at Adept and the rest Novice. Text limits are the Character and Skills fields'.
 */
export const CREATION = Object.freeze({
    start: 10, budget: 6, min: 8, max: 15, skills: 5, adept: 1,
    name: 40, about: 240, skillName: 40, skillAbout: 120,
});
