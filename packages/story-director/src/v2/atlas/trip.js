// Story Director v2, atlas part: trips (pure).
//
// A trip is planned once, when the story starts it (`~ trip Wolfmere Outpost | by: riding | via: …`): from where
// {{user}} is to the destination along **known routes only** (the atlas's: the packs' routes and the story's
// `+ route` lines), through each `via`, the shortest by km. The legs are kept as they were planned, with their
// story times, so a replay is exact whatever the routes or the mounts become later. Nothing about *where* the
// party is now is stored: it is worked out from the story time against the legs (`positionOf`).
//
// Kept in the atlas domain's `trips`, a record per line, keyed `<rev>.<n>` (per-reply bookkeeping, SPEC §2.2):
//   go    { kind: 'go', at, rev, to, by, mode, pace, unit, mount, short, setOut, legs: [Leg] }
//   delay { kind: 'delay', at, rev, minutes, because }
// `Leg` = { from, to, km, kind, days, start, arrive, skip? }: names in the direction of travel, the road's length
// `km`, `skip` km of it already behind the traveller when the leg starts (a trip begun mid-road), `days` what the
// planner counted for the part still to go, `start` and `arrive` story minutes. A new trip or a stop takes every
// earlier record away; a delay is its own record, applied when the trip is read, so deleting the reply that made
// the trip leaves later delays harmless (they have nothing to move).
//
// Public face: re-exports its parts.

export { MAX_DELAYS, MAX_DELAY_DAYS, MAX_LEGS, TRIP_FEATURE } from './trip-parts/feature.js';
export { basePace, modeOf, modeWords } from './trip-parts/modes.js';
export { planTrip } from './trip-parts/plan.js';
export { nodesOf, positionOf, tripOf } from './trip-parts/state.js';
export { isOver, startOf } from './trip-parts/status.js';
export { calendarOf, dateText, legTime, paceText } from './trip-parts/format.js';
export { tripLines, tripView } from './trip-parts/view.js';
