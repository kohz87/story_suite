// The Skills view (mockup section 3): a character's skills in place of the Party cards, like the Spend points sheet. Each skill shows
// its name, a rank pill toned by rank, "STAT · Uses", what it does, a four-cell mastery bar (`ss.meter`) and the roll it makes from
// the live sheet ("Rolls with it: d20 +12 = VIT 12 → +6 · Expert +2 · Lv 14 ÷ 5 +2"). Empty slots are a dashed line. Rank and
// practice only move through play, so the pencil edits the name and the description and nothing else, in ONE multi-field `dm.set`.
// Every node is built with createElement and textContent.
// Public face: re-exports its parts.

export { RANK_TONES } from './skills-parts/shared-ranks.js';
export { masteryOf, rollOf } from './skills-parts/roll.js';
export { slotsShown, hasTypes, poolsOf } from './skills-parts/slots.js';
export { newSkillsSession, renderSkills } from './skills-parts/render.js';
