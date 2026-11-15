// Re-exports the flow version, outcome rule and positional dice from resolve/dice.js.
import { FLOW_VERSION, outcomeOf, positionalDice } from '../resolve/dice.js';

// The flow version, outcome rule and dice streams live in resolve/dice.js; this file keeps the record and the guard.
// `prepare` is the Standard preparation.
export { FLOW_VERSION, outcomeOf, positionalDice };
