// Practice for the skills a reply's rolls used, given by code (stage 50).
//
// Every skill used in a reply's rolls, an act's or a check's skill and a defender's skill, is practised: the setting's practice per use (1 to 5, recorded with the roll), summed per
// skill and held to PRACTICE.max (20) a reply, the same 1..20 the Skills block's own practice line takes. Only a roll made WITH the skill counts: an
// untrained roll (a skill the character lacks, or one whose resource was Empty) names no skill in its line and gives nothing. Rank-ups follow the
// block's own rules (a skill at 100 practice rises a rank and starts again).
//
// How. `practiceHook` (the part's afterCapture) reads the reply's own roll (the `rpg.resolve` receipt, from a payload that carries `practice`; a roll made before has none and gives none, so past replies replay as recorded) and asks for guarded `rpg.practice { uses }` steps of at most 40 distinct skills,
// `uses` = [{ who, skill, n }]: the character, the skill as the roll named it, and how many lines used it; `perUse`: the practice one use gives, the value the roll recorded. The step is a guarded block on the reply
// (replan: a swipe or a delete takes it away, a Re-read plans it again, REPLAY.md), like the fight's XP.
//
// No double count: in that reply the narrator's own practice lines for the same skills are not used. The first story line of the reply that practised a
// slot kept what the slot's practice and rank were before it (data-modules/part.js, the reply's scratch `practiceFrom`); the step puts those back before
// it adds the code's practice, and one Problems line says so. A narrator's practice line for a skill the rolls did not use is untouched.
//
// The record (the step's receipt `data.v2.result.practice`): { skills: [{ who, skill, slot, amount, held? }] }.
//
// Story checks (checks/): the same file holds the reply's check step. `checksHook` (afterCapture) reads the reply's `? roll` lines (their `capture.roll`
// receipts) and its recorded dice (the `rpg.dice` receipt, which also holds the rules and the practice per use the reply was offered under: never today's settings)
// and asks for one guarded `rpg.check` step. It works the lines and gives their skills practice together, so a replan cannot leave practice attached to an old
// result. The lines it refused are one Problems line. No XP. `checksOf(receipts)` reads the results back for the card.
// Public face: re-exports its parts.
export { usesOf, rollOf } from './practice-parts/uses.js';
export { practiceHook } from './practice-parts/hook.js';
export { PRACTICE_HELD } from './practice-parts/give.js';
export { practiceStep, practiceGuard } from './practice-parts/step.js';
export { membersOf } from './practice-parts/members.js';
export { checksHook } from './practice-parts/checks-hook.js';
export { checksOf } from './practice-parts/checks-record.js';
export { checkStep, checkGuard } from './practice-parts/check-step.js';
