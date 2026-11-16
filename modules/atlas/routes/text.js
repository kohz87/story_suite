// Story Director: route and leg text shown to the reader and sent to the model (pure).
//
// formatRoute, formatLeg, durationText and the small word helpers behind them. Split out of
// routes.js, which still re-exports every name it exported before.
// Public face: re-exports its parts.

export { formatRoute, formatLeg, durationText } from './text-parts/route-format.js';
export { hopText, routeText, exitsText, roadName } from './text-parts/path-text.js';
export { unitOf, rateWords, toleranceFor } from './text-parts/units.js';
export { rangeText, dateText, capitalize } from './text-parts/value-text.js';
