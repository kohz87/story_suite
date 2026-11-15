// Story Director v2, atlas part: the shape of `atlas.trips` (pure). Kept apart from domain.js and trip.js so the domain's
// validator can use it without the two importing each other.
// Public face: re-exports its parts.

export { MAX_DELAYS, MAX_DELAY_DAYS, MAX_LEGS, MAX_TEXT } from './trip-shape-parts/limits.js';
export { KEY, tripsProblems } from './trip-shape-parts/validate.js';
