// Story Director: world packs and travel maths (pure).
//
// A world pack is a route graph (places, undirected edges with km and a road code) plus
// paces per code and mode and a few travel rules. From it this module finds shortest routes,
// turns km into days with the pack's round-up rule, and checks the one-hop `leg:` lines the
// model writes, offering a corrected leg in the same grammar when one is wrong.
//
// Nothing here knows the calendar module: story time is abs minutes, and the functions that
// read or print dates take an optional `calendar` object (parse, format, addDays, dayIndex).
// Packs are treated as immutable; a lookup index is cached per pack object.
//
// The code lives in src/routes/ (pack.js, plan.js, leg.js, text.js, util.js); this file re-exports
// every name it exported before the split, so the old import path keeps working.
// Public face: re-exports its parts.

export { ROUTE_CODES, MODES, MODERN_MODES, MODERN_CODES } from './routes-parts/codes.js';
export { MODERN_RULES, DEFAULT_RULES, loadWorldPack, packSummary } from './routes-parts/rules.js';
export { findPlace, placesIn, exitsFrom } from './routes-parts/places.js';
export { codeName, paceFor, boardDays, legDays } from './routes-parts/pacing.js';
export { restDaysFor, overnights, shortestPath, planRoute } from './routes-parts/routing.js';
export { parseLeg, validateLeg } from './routes-parts/legs.js';
export { formatRoute, formatLeg, durationText } from './routes-parts/formatting.js';
