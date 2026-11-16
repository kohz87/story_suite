// Story Director v2, atlas part: how long a trip takes (pure).
//
// v1's travel maths, over the joined world (world.js). Along known routes: a route's own time
// when the story or a pack gives one in hours, else its km at v1's paces (`DEFAULT_PACES`, km a
// day; a modern map's `MODERN_PACES`, km an hour) with v1's round-up per leg (`legDays`) and
// rest days for the whole trip (`restDaysFor`), as v1's planRoute counts a world pack's roads.
// Water and air routes go by boat, ship or flight whatever the trip's mode. With no way along
// routes, v1's estimate from the map's coordinates (`estimateTrip`: the straight line times the
// road factor). Unknown otherwise.
// Public face: re-exports its parts.

export { defaultMode, hopMode, routeDays } from './travel-parts/modes.js';
export { TOWN_HOP_DAYS, TOWN_HOP_HOURS, townOf, travelTime } from './travel-parts/route.js';
