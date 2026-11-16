// Story Director: paces, day maths and the route planner (pure).
//
// Turns km into days with a pack's round-up rule, picks the pace for a road code and mode,
// and finds shortest routes (shortestPath, planRoute). Split out of routes.js, which still
// re-exports every name it exported before.
// Public face: re-exports its parts.

export { codeName, inferMode, paceFor, acceptedRange } from './plan-parts/pace.js';
export { boardDays, legDays, restDaysFor, overnights } from './plan-parts/days.js';
export { hopDays, bestEdge } from './plan-parts/hop.js';
export { search, shortestPath, planRoute } from './plan-parts/search.js';
