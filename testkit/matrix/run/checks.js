// State checks and host probes for the matrix runner, moved unchanged from run.js: no store problems,
// a cold rebuild from the chat, changed facts, the fresh-host oracle, dormancy, registration and the
// held-back first message.
//
// Public face: re-exports its parts.

export { noProblems, replayed, changed, oracle } from './checks-parts/state.js';
export { gap, dormancy, gapNote } from './checks-parts/dormancy.js';
export { checkRegistered, heldBack } from './checks-parts/registered.js';
