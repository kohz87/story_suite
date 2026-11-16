// `rpg.resolve`, the RPG's prelude (SPEC_RPG §2R A3/A5, SPEC_RPG_v1 §4.5.3 and §5).
//
// What it is. Today the fight board makes the rolls (board/commit.js `resolveBoard`). This file keeps what OLD chats need: the plan-based roll the
// retired planner made (`rpg.resolve { key, plan }`, Standard formula only: a record with no `formula` replays as Standard), its record and its replay
// guard. A Re-read keeps the dice (same payload, same seed) and deleting the reply removes them.
// It changes no block value: the narrator's own change lines (set-health, add-xp, practice) do that.
//
// Dice. Each planned action has dice of its own, drawn from the receipt's seed and the action's place in the plan (its index
// among the plan's acts, foes or checks), so an action that is refused, or comes back when the story before it changes, never
// moves another action's dice. A check is one d20; an act or a foe's attack is two d20s a round (the party member's, then the
// foe's), round by round while the fight goes on. (A roll made before that, whose payload has no `dice` version, drew one
// sequence from the seed: the checks first, then each round's actions in plan order; that is kept for it.) A party
// member's total is d20 + floor(stat/2) + 2×Soul Class + skill rank + edge; a foe's is d20 + 5 + 2×class (names.js
// FORMULA; those are Standard's numbers, and the roll is made with the numbers its payload carries, rules.js: the replay rule). A skilled act or check rolls with the skill's own stat and spends the skill's own resource (the Skills block's
// `statN` and `usesN`; the plan's `stat` and `uses` are not read for it); an act with no skill, or with one the character
// lacks, rolls the plan's stat at rank 0. The
// outcome is the party member's: a natural 20 succeeds, a natural 1 fails, a total that reaches the other side
// succeeds, one within FORMULA.costMargin short is "success at a cost", anything else fails. A foe's attack is
// the same roll seen from the defender, who rolls with the `defend` stat, or with a skill the plan names (`skill`, which a skill the defender
// has resolves like an act's: its own stat and rank, an Empty resource rolls without it; one they lack is rolled untrained). Rounds = the smallest of the
// pace (careful 1, normal 5, all 8), LIMITS.roundCap, the first decisive round (a natural 1 or 20 on any die, or a
// margin of LIMITS.decisiveMargin either way) and what fits the cue budget (LIMITS.cueTokens); at least one.
//
// The flow of stage 49 (`flow: 2` in the payload, FLOW_VERSION; a roll made before has none and keeps the rule above exactly): a reply's exchanges run
// until the first of: the fight is WON (every filled foe group is Down), LOST (every party member who has not Left is Down), HEAVY (a party member
// has lost 2 or more Health blocks in this reply, or went Down), the CAP (the rules' most exchanges per reply, 8 by default), the cue BUDGET, or,
// at the careful pace, one exchange. A decisive result is still labelled and still has its effect (a double hit under Standard) but no longer
// ends the reply. Rounds follow the bars round by round: a foe group or a party member who is Down does not act in later rounds ("does not act").
// Standard moves the real bars (the hurts the told rolls took or gave).
//
// Refusals (plain sentences, in the cue and in `refused`): a character the sheet does not have, a stat the character
// lacks (or none to roll with), a foe that is not there or whose slot is empty, a character who is Down: that action is
// not rolled. A skill the character does not have is rolled untrained (rank 0, no skill named); so is one whose resource
// (the skill's `uses`) is Empty, with the skill's stat, and the cue says so.
//
// Replay. Guarded (docs/v2/REPLAY.md) and `replan`: the guard asks that the sheet inputs this roll used are still what
// the prefix holds; when an earlier reply is deleted or swiped and they changed, the roll is planned again with the same
// dice on the new numbers. Claim `rpg:resolve:<key>` (the reader's message) keeps it to one roll per message.
//
// The Standard formula (rules.formula 'standard') rolls in standard/roll.js (re-exported by standard.js). Its record adds typed lines, the
// turn order, the opening action, the bars and the blocks the told rolls took or gave (`hurts`, written to the bars below).
//
// ---- The record for the battle log (agent B) ----------------------------------------------------------------------
// The receipt (type 'rpg.resolve', on the reply's record: message.extra.storySuite.receipts, or the query `rpg.rolls`)
// has `summary` = the cue text and `data.v2.result` =
//   { v: 1, key, pace: 'careful'|'normal'|'all',
//     stop: 'won'|'lost'|'heavy'|'pace'|'cap'|'budget'|'none',   why the rounds end where they do ('none': checks only); a roll made
//           before the flow of stage 49 (no `flow`) says 'decisive' (a round with a natural 1 or 20 or a margin ends it) or, Standard, 'over'
//     flow?: 2,                                                  the rule the rounds stopped by (FLOW_VERSION)
//     checks: [Line], rounds: [{ n, decisive, lines: [Line] }],   the rounds TOLD to the narrator, in order
//     refused: [{ who, text }],                              not rolled, or a skill refused (text is a plain sentence)
//     ambush?: { who, skill, outcome, total, dc, success }  an ambush check's result (ambush.js); a success gave the party's round-1 acts +2
//     summary: { exchanges, acts: [{ kind, who, target, skill, stat, outcomes: ['success'|'cost'|'fail', …] }], refused: n } }
// and a Line is
//   { kind: 'act' | 'foe' | 'check', outcome: 'success'|'cost'|'fail', skill: string|null, why?: string,
//     pc:  { who, die, stat, statBonus, classValue, classBonus, rank, edge, total },
//     foe: { slot, name, die, base, classValue, classBonus, total }          (acts and foe attacks; not checks)
//     difficulty, dc                                                          (checks only) }
// Every number is final: total = die + statBonus + classBonus + rank + edge for the party and die + base + classBonus
// for a foe. 'act': the party member attacks (the outcome is theirs); 'foe': the foe attacks, `stat` is the defend
// stat (or the defending skill's), `skill` the defending skill (null: none; a roll made before there were any has none) and `pc` the
// defender (outcome 'fail' means the defender failed). `summary.exchanges` = rounds.length is the
// number B shows as "Rolled for you: N exchanges". The told count is not recorded: the narrator is not asked to count.
// Public face: re-exports its parts.
export { RESULT_VERSION, DICE_VERSION, claimKey } from './resolve-parts/versions.js';
export { FLOW_VERSION, outcomeOf, positionalDice } from './resolve-parts/dice-face.js';
export { prepare, rollPrepared, fieldMax } from './resolve-parts/roll.js';
export { orderOf } from './resolve-parts/payload.js';
export { resolve } from './resolve-parts/command.js';
export { leanRpgGuard } from './resolve-parts/guard.js';
export { rollsOf } from './resolve-parts/reads.js';
