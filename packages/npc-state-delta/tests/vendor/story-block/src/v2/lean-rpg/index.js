// The RPG (suite-notes/SPEC_RPG.md): an optional part of Story Block's core module, behind the feature
// `story-block.rpg` (off by default; off means fully off, features.js). It reads the chat's
// RPG blocks (custom blocks whose definition has a `role`, see ROLES) and adds:
// - automatic rolls: a pre-call before the reply plans the actions, `rpg.resolve` rolls them as a
//   prelude block on the generated reply (a swipe rolls again, a Re-read keeps the dice);
// - the Party tab, the stat distribution view and the battle log (view/, loaded only when the feature is on);
// - "Changed this reply" lines for rolls and automatic level-ups.
//
// This file holds the shared interfaces the pieces build against and the part itself. The names live in
// names.js, the plan in plan.js, the sheet reader in read.js, the pre-call in precall.js, the roll in resolve.js
// (its header documents the `data.v2.result` record the battle log draws from) and the cue text in cue.js.
// Public face: re-exports its parts.

export { parseCheckLine } from './checks/line.js';
export * from './names.js';
export { DIFFICULTIES, DIFFICULTY_SETTING, EARLIER_RULES, STANDARD, STANDARD_FORMULA, STANDARD_PRESETS, STANDARD_RANGES, STANDARD_RULE_KEYS, STANDARD_SETTING, difficultyOf, isStandard, normalizeRules, packInForce, packRulesOf, normalizeStandard, oddsFor, oddsSubject, presetOf, rulesFromSettings, sameRules, subjectOdds } from './rules.js';
export { classTerm, divisorOf, hasLevels, levelCapFor } from './rules.js';
export { classOfLevel, levelBonus, levelOfClass } from './formula.js';
export { planIsEmpty, validatePlan } from './plan.js';
export { characterOf, fold, matchCharacter, matchFoe, matchName, matchSkill, readSheet } from './read.js';
export { RANK_QUERY, SETTINGS_SCHEMA, XP_RATE, XP_RATE_SETTING, bandsOf, clampLevel, levelLabel, packLevelsOf, playerRankValue, rankNamed, rankOf, scaleXp, xpRateFrom, xpRateOf } from './levels.js';
export { FIGHT_XP_HELD, fightOf, memberXp, standingSlots } from './fight.js';
export { PRACTICE_HELD, practiceStep, usesOf } from './practice.js';
export { NO_ROLLS_LINE, OPEN_FIGHT_LINE, OUTCOME_WORD, cueOfResult, cueText, fitCue, lineText, receiptCue } from './cue.js';
export { QUIET_GRAMMAR, fightIsOpen, isQuiet } from './quiet.js';
export { JOIN_ADD, JOIN_BENCH, JOIN_NO, benchable, checkJoin, joinCard, joinDefinitions, joinDraft, joinGrammar, joinGrammarOwn, joinMode, joinOffers, joinScale, partyCap, partyOf, readJoin, soulNaming, soulOf } from './join.js';
// What the data modules' companion steps (data-modules/part.js) reach through the loaded library (rpg-lazy.js).
export { RPG_EXTRAS, extraDefinitions, extraName, extrasPlan } from './view/wizard-data.js';
export { RPG_STRINGS } from './strings.js';
export { grownSkills } from './templates.js';
export { setStartNotes, skipOf, startNotes } from './start.js';
export { claimed, createPrecall } from './precall.js';
export { boardInputError } from './board/commit.js';
export { dropOf } from './ambush.js';
export { foesOf, rpgBlocks } from './view/party-data.js';   // (the prompt's fight cue reads them through rpgLib: the page start must not load them)
export { narratedFoeGrammar } from './board/narrated-grammar.js';
export { boardGrammar, boardReplyGrammar, boardXpGuide } from './board/prompt.js';
export { DICE_VERSION, FLOW_VERSION, RESULT_VERSION, claimKey, leanRpgGuard, outcomeOf, positionalDice, prepare, resolve, rollPrepared, rollsOf } from './resolve.js';
export { DEFAULT_SETTINGS, JOINS_QUERY, createLeanRpgPart } from './index-parts/part.js';
