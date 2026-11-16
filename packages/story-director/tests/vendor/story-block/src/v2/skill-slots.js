// How many skill slots a Skills block can hold and how many a character has at a level: 5 to start, one more at Lv 20, 40 and 60, up to 8 (a level drop
// never takes a skill away). The `sig` field marks the slots a pack's cast gave (bit n - 1 for slot n). Kept outside lean-rpg/ so the page start stays small.
// Public face: re-exports its parts.
export { SKILL_SLOTS_MAX, SKILL_SLOTS_BASE, SKILL_SLOTS_EVERY, skillSlots } from './skill-slots-parts/counts.js';
export { UTILITY_SLOTS, SKILL_FIELDS_MAX, SKILL_TYPES, SLOT_NUMBER } from './skill-slots-parts/layout.js';
export { isTypedSkills, skillFieldSlots, skillTypeOf } from './skill-slots-parts/typed.js';
export { SIGNATURE_FIELD, signatureAt } from './skill-slots-parts/signature.js';
