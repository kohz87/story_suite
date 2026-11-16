// The ambush check (PRACTICE-FIX 4): a skill used before a fight to gain the drop on the foes (hiding, sneaking, luring, slipping behind them)
// is a plan `check` that carries `ambush`. Pure: the roll reads the check's own outcome.
//
// A successful ambush check gives the party's acts of round 1 an edge of +2 (inside the 3 an edge may reach), and under Standard the quick start: each
// character with an act against a foe gets the opening action without the lead the margin asks. A failed one (a cost counts as failed) gives nothing: no
// surprise. Without such a check there is no ambush edge: an act's own "+2 ambush" edge is dropped when the plan has none
// (plan.js). The check's skill earns practice through the existing path (it is one of the roll's checks).
// Public face: re-exports its parts.

export { ambushOf, ambushRecord } from './ambush-parts/roll.js';
export { carriedFrom, dropOf } from './ambush-parts/carried.js';
export { AMBUSH_EDGE, ambushedStandard } from './ambush-parts/standard.js';
