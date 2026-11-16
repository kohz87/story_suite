// Gear in the rolls (`story-block.gear`, docs/v2/GEAR.md "In the rolls"). Pure, apart from the questions put to `query`.
//
// What it does. While the switch is on, the roll (the board; the old planner did so too) asks the inventory what each party member has on and carries (`planGear`),
// and the roll carries only the version mark in its payload (`gear: { v: 1 }`); `rpg.resolve` works the gear out from the state before the roll (`planGear`
// over the inventory's own answers) into the record `gear: { v: 1, who: { <member key>: { own, add?, enc?, items? } } }`:
//   own    the inventory owners the member's gear is filed under (their party actor, and `party` for the reader's lead: the first character);
//   add    { str…cha: +n } what the worn pieces give (broken ones give none), summed;
//   enc    the penalty (-2) to AGI and DEX while they carry more than they can;
//   items  [{ name, stats }] the pieces that give something, for the log.
// The roll reads the sheet through `applyGear`: effective stat = stat + add, held to 30, then AGI and DEX + enc (never under 1). The record is in the
// guard's predicate and the result, so a rebuild and a reload roll with it, and equipping something later never moves a roll that was made. The guard
// asks the state before the roll for the same pieces and load (`gearMatches`): a change before the roll (the reply that gave and equipped the gear deleted
// or edited) no longer matches, and the roll stands off until it is Re-read, which works its gear out again. A roll with no `gear` (made before) is read
// exactly as before. Off means no `gear`, and nothing here runs.
//
// Wear (`wearGear`): a decisive hit taken wears the member's body armour (else their off-hand) one step; a decisive miss wears their weapon one step
// Public face: re-exports its parts.
export { sameWho, gearIsOn, planGear } from './gear-parts/plan.js';
export { GEAR_VERSION, STAT_MAX, ENCUMBERED, ENCUMBERED_STATS } from './gear-parts/shared-marks.js';
export { GAP, earnedLegend } from './gear-parts/legend.js';
export { dressOf, gearMatches } from './gear-parts/dress.js';
export { gearMarkOf, gearValid, gearOf } from './gear-parts/record.js';
export { applyGear, gearOfLine, noteGear } from './gear-parts/apply.js';
export { isDecisive, wearGear } from './gear-parts/wear.js';
export { gearSoakRecord } from './gear-parts/soak.js';
