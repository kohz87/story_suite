// Social checks against an NPC (feature npc-state-delta.social): how an NPC's dossier stage and
// meters change the difficulty of a social check the player makes against them. Delta owns these
// rules; the dice belong to whoever rolls (RPG Battle reads the answer through its "check modifiers
// from other modules" hook). Read-only: nothing here writes state, sends a prompt or calls the model.
//
//   npc.socialModifier({ name, skill }) → { mod, name, skill, reasons: [{ text, value }] } | null
//
// * `skill`: a social skill word (SKILL_WORDS): persuade, charm (seduce), intimidate, deceive, or the
//   generic `social`. Any other word (Athletics, Stealth, "sleight of hand") is null, so a non-social
//   check is never touched.
// * `mod`: a whole number added to the d20 roll, within ±cap (setting `socialCap`, default 5).
//   `reasons` are the parts, in a fixed order (meters in Delta's order, then the stage ladder, then
//   the disposition word), and always add up to `mod`; a part of 0 is left out. A check display
//   shows each as `${text} (${signed value})`: "Elula trusts you (+2)", "Old Hob is wary of you (−1)".
// * The rules (all here, all whole numbers):
//   1. Each meter the skill uses (SKILL_METERS) counts by how far it is from 0, as a share of its
//      range's far end (a built-in −100..100 meter as is; a 0..100 custom one the same; a 0..10 one ×10):
//      25 or more → 1, 50 or more → 2, 75 or more → 3 (STEPS), signed like the value and multiplied by
//      the skill's weight for that meter (+1 helps the player, −1 works against them). A meter the
//      reader does not have (fear, loyalty, respect, … are custom meters) is skipped.
//   2. The stage ladder (feature npc-state-delta.stages): +1 for each rung reached, at most +2
//      (RANK_BONUS_MAX), for every skill but intimidate.
//   3. The NPC's disposition word (the slice's `disposition`, from "~ npc Name | disposition: wary"):
//      a warm word +1, a cold word −1 for every skill but intimidate; a frightened word +1 and a
//      defiant word −1 for intimidate (DISPOSITION_WORDS).
//   4. Each part is multiplied by the scale (setting `socialScale`, a percent, default 100; 0 turns
//      every modifier to 0) and rounded half away from 0; the sum is held to ±cap, and when it is
//      held, one last reason ("Held to the most a check moves") carries the difference.
//
// Pure: no DOM, no clock, no randomness; the same entry, settings and skill give the same answer.
// Public face: re-exports its parts.
export { FEATURE_SOCIAL, SOCIAL_QUERY, SOCIAL_SKILLS } from './social-check-parts/names.js';
export { DEFAULT_SOCIAL_SCALE, MAX_SOCIAL_SCALE, DEFAULT_SOCIAL_CAP, MAX_SOCIAL_CAP } from './social-check-parts/limits.js';
export { RANK_BONUS_MAX, STEPS, SKILL_METERS, DISPOSITION_WORDS } from './social-check-parts/rules.js';
export { SKILL_WORDS, socialSkill } from './social-check-parts/skill.js';
export { socialSettings } from './social-check-parts/settings.js';
export { meterPoints, socialModifier } from './social-check-parts/modifier.js';
