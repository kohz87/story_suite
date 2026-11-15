// Gear's condition words and prices (moved out of domains/gear.js unchanged; gear.js re-exports every public name).
// A piece's cond is 0...100; Good is unmarked and the other words set what a price is worth. Pure. Public face: re-exports its parts.

export { CONDITION, condWord, condMark, valueByCond } from './conditions-parts/words.js';
export { stepDown, stepUp } from './conditions-parts/steps.js';
