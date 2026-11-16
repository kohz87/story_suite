// Logical clock markers. Identity and activation use E5's single proof allocator and pin rule.
// Public face: re-exports its parts.
export { CLOCK_COMMANDS, markerHash, markerProblem } from './boundary-parts/marker.js';
export { clockWriteProblem, markerPrefixProblem } from './boundary-parts/write-check.js';
