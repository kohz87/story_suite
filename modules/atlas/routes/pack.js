// Story Director: world-pack loading and place lookup for the route files (pure).
//
// Route constants (codes, modes, rules), loadWorldPack and its readers, the per-pack lookup
// index, place matching (findPlace, placesIn, exitsFrom, edgesBetween) and normalizeMode.
// Split out of routes.js; routes.js still re-exports every name it exported before.
// Public face: re-exports its parts.

export { ROUTE_CODES, MODES, MODERN_MODES, MODERN_CODES } from './pack-parts/codes.js';
export { TRANSFER_MODES, TRANSFER_KM, MODERN_DEFAULT_MODE, SELF_MODES } from './pack-parts/modern-constants.js';
export { MODERN_ALIASES, MODE_ALIASES, LAND_MODES, WATER_MODES } from './pack-parts/aliases.js';
export { MODERN_RULES, DEFAULT_RULES, DEFAULT_COURIER_MULTIPLIER } from './pack-parts/rules.js';
export { KM_TOLERANCE, DAYS_TOLERANCE, EPSILON } from './pack-parts/tolerances.js';
export { normalizeMode } from './pack-parts/mode.js';
export { loadWorldPack, packSummary } from './pack-parts/load.js';
export { indexOf, normalizeName } from './pack-parts/index.js';
export { findPlace, placesIn, resolvePlace } from './pack-parts/places.js';
export { exitsFrom, edgesBetween } from './pack-parts/graph.js';
