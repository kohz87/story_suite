// Names: rank and class names, resource uses and the creation budget.

/** What a skill's rank (0–3) and a Soul Class (1–9) are called. */
export const RANK_NAMES = Object.freeze(['Novice', 'Adept', 'Expert', 'Master']);
export const CLASS_NAMES = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']);

/** What a skill spends: its `uses` (a skill whose resource is Empty is rolled without it). */
export const USES = Object.freeze(['stamina', 'mana']);

/**
 * The New character wizard's budget (SPEC_RPG, mockup section 4): every stat starts at `start`, the reader has `budget`
 * points to spend, a stat never goes below `min` (the start: Combat Rules v1, decision 39.3) and goes up to `max` at creation. A character starts with up to
 * `skills` skills, at most `adept` of them at Adept and the rest Novice. Text limits are the Character and Skills fields'.
 */
export const CREATION = Object.freeze({
    start: 5, budget: 10, min: 5, max: 10, skills: 5, adept: 1,
    name: 40, about: 240, skillName: 40, skillAbout: 120,
});
