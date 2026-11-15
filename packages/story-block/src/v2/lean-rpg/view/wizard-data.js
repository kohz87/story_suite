// What the New character wizard works out, without a DOM: the draft's shape, the stat budget, the skill rules (up to five, at most
// one starting at Adept), the skill sets on offer (built in and from packs), the problems that stop Create, and the two block
// definitions Create makes. The draft lives in the dialog (`api.draft`), so this reads it as plain data and never trusts it:
// `readDraft` clamps whatever it finds. Field names are the ones the Character and Skills templates use (templates.js).
//
//   draft = { name, kind: 'you' | 'companion', about, stats: { str…cha }, skills: [{ name, about, stat, uses, start: 0 | 1, rank? }], set, soul?, from? }
//   `creation` (Standard only): { start, budget, min, max, statMax, standard: true }, the numbers creation runs on (stats start at `start`, `budget`
//   points to spend, a stat from `min` to `max`); a draft without it runs on the Standard preset's numbers.
//   (start is the rank a skill begins at: 0 Novice, 1 Adept; `set` is the id of the skill set last put in, '' for none; `soul` is the
//   level (the starting level of a new character, a companion who joins or an imported one, 2 to 99; left out it is 1). `from` and a skill's
//   `rank` are there only after an import (a saved character file, ../charfile.js): `from` = { stats, points } is what the file had, which
//   the stats are spent from, and `rank` (0 to 3) is the rank the file gave a skill, which is not typed and not counted as the Adept one.)
// Public face: re-exports its parts.

export { WIZARD_STEPS, KINDS } from './wizard-data-parts/steps.js';
export { START_RANKS, startName, rankOf } from './wizard-data-parts/ranks.js';
export { creationOf, draftCreation, draftLevel } from './wizard-data-parts/creation.js';
export { draftSlots, combatSlots, utilityCount } from './wizard-data-parts/slots.js';
export { newDraft, readDraft, startStats } from './wizard-data-parts/draft.js';
export { pointsLeft, statsLine, statBounds } from './wizard-data-parts/stats.js';
export { adeptCount, mayStartAdept } from './wizard-data-parts/adept.js';
export { withSet, withSkill, withSkillPatch, withoutSkill } from './wizard-data-parts/skill-edits.js';
export { withImport, withoutImport } from './wizard-data-parts/import.js';
export { skillSetsOf, setLine } from './wizard-data-parts/sets.js';
export { CREATE_ACTIONS, actionsFree, problemsOf } from './wizard-data-parts/problems.js';
export { hasRoom, RPG_EXTRAS, missingBlocks, extrasPlan } from './wizard-data-parts/extras.js';
export { newSoul, extraName } from './wizard-data-parts/shared-template.js';
export { extraDefinitions, blockNames, buildDefinitions } from './wizard-data-parts/definitions.js';
