// Reading the sheet (SPEC_RPG §2R, brief A4): the RPG blocks of the chat, from the head state.
//
// An RPG block is a pinned chat block whose definition has a `role` (names.js ROLES). Field keys are fixed
// (suite-notes/rpg-briefs/COMMON.md):
//   character: who, health, mana, stamina (stage indexes, 0 = empty), str vit agi dex int luk cha, points, level (1–99; a block made before levels has soul 1–9 instead), cap,
//              xp, down (the death latch, hidden), alive
//   skills:    who, then per slot 1…5: skillN (name), aboutN (what it does), statN (one of the seven stats), usesN (stamina |
//              mana), rankN (0–3), practiceN (0–100)
//   foes:      foe1…foe6 (text; an older block has 1…4), count1…count6, level1…level6 (1–99; a block of the earlier rules has class1…class6, 1–9), hurt1…hurt6 (0–5)
// Pure and read-only: it takes a state (or anything shaped `{ domains: { dataModules } }`) and answers plain data. It
// never validates the definitions (the data-module checker did when they were pinned); a block it cannot read is left
// out, with a plain `problems` line.
// Public face: re-exports its parts.
export { fold, sameWho, matchName, matchSkill } from './read-parts/match.js';
export { matchCharacter, matchFoe, characterOf, strongestStat } from './read-parts/lookup.js';
export { readSheet } from './read-parts/sheet.js';
