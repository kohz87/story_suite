// XP for a won fight, given by code (stage 49; by level from the Levels release).
//
// When a reply's story takes the fight from "at least one filled foe group is standing" to "every filled foe group is Down" (by the dice, which write the
// foes' bars under the Standard formula, or by the narrator's own foe lines), the party is paid once, for that fight: every party member who has not Left
// (a Down member too; a dead one is not paid) gets XP of their own, from their level against each group's (names.js FIGHT_XP: count × max(1, ceil(foe level / 10)) × 2,
// times 100% plus 10% for each level the foe is above the member (and minus 10% for each level below), held between 0% and 200%; summed and rounded down, held to 1..60, and
// nothing at 0, with no receipt line; a board fight captured from 11 Nov (`xp: 2` in its step) pays 15 for every foe instead, the same gap per cent, at most 100: level 5 against six level 5 foes gives 90; a Re-read keeps the formula the fight was paid with, REPLAY.md); level 5 against six level 5 foes gives 12 on the old one, level 25 against them gives 0. The groups of the fight are the ones that were standing when the reply began and are still on the Foes
// block; a group the narrator cleared is not Down, it is gone (fled, yielded), and a fight with none of its groups left is not won. A later reply that fills
// the slots again and wins is a new fight, since the groups it starts from are the standing ones. A group that arrives in the reply itself (the pre-call's
// opened foes, or the narrator's own set-slot line) is part of that reply's fight, so a fight opened and won in one reply is paid.
// A sheet entry without a `level` (a block of the older templates, which has a Soul Class / foe class 1..9) counts as that class as its level.
//
// How. `fightHook` (the part's afterCapture) compares the reply's state with the one before it (view.before) and, only for a won fight, asks for the step
// `rpg.fight { was }`: `was` = the slots standing before the reply. The step is a guarded block on the reply (replan: a swipe or a delete takes it away, a
// Re-read and a middle delete plan it again on the new story, REPLAY.md), so the live state, a rebuild and a reload agree. It runs the character block's own
// rules (the level rises at 100 XP) through the block interpreter, as the narrator's `add-xp` line does.
//
// No double count: in that reply the narrator's XP for a party member is not used. The first story line of the reply that wrote a character's XP kept what
// that character's xp, soul and points were before it (data-modules/part.js, the reply's scratch `xpFrom`); the step puts those back before it adds the
// code's XP, so the narrator's line and the rise it brought are gone, and one Problems line says so. XP in any other reply (a quest, a discovery) is
// untouched: the step exists only in the reply that won the fight.
//
// A board win (the reply's `rpg.resolve` receipt says `won`) is paid whatever the story did to the Foes block after it: a new group the narrator opened in the same
// reply (the reinforcements a finished fight allows), or the Down groups it cleared, no longer hide the win. When the block still shows the fight's groups Down, the step is
// asked for as ever; when it does not, the step carries `groups` (the fight's groups as the reply began, or as its roll opened them), and pays from those.
// New fight steps carry `outnumbered: 1`: each foe above the party's non-Left members adds 0.5 to the XP multiplier, up to 2. The multiplier applies after the level gap,
// before rounding and the rule's cap; a step without the mark keeps its original XP, guard and receipt on replay and Re-read.
//
// The record (the step's receipt `data.v2.result.fight`): { lv: 1, groups: [{ slot, name, count, level }], awards: [{ who, module, xp, held? }] } (xp is the member's own). A record without `lv` is an
// older one (groups carry `class`); it is read as it is and replays as recorded.
// Public face: re-exports its parts.

export { FIGHT_XP_HELD } from './fight-parts/step.js';
export { foeLevel, memberLevel, standingSlots } from './fight-parts/levels.js';
export { fightOf, groupsOf } from './fight-parts/won.js';
export { outnumberedMultiplier, memberXp } from './fight-parts/xp-amount.js';
export { fightWitness } from './fight-parts/witness.js';
export { openedSlots } from './fight-parts/opened.js';
export { fightHook } from './fight-parts/hook.js';
export { fightXp } from './fight-parts/step.js';
export { fightGuard } from './fight-parts/guard.js';
