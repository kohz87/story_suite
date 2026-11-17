// Top-level pack.json fields, the money-scale (economy) fields and limits, and the start fields.

// Top-level fields of pack.json; anything else is refused so a typo is not silently ignored.
export const PACK_FIELDS = Object.freeze(['id', 'format', 'version', 'name', 'author', 'description', 'requires', 'currency', 'economy', 'calendar', 'weather', 'ripples', 'content', 'start', 'layouts', 'screens', 'theme']);
// A pack's money scale (MODULES §F104): `{ scale?: 0.001–1000 (default 1), note? }`. `scale` multiplies the
// built-in money defaults (a module's default loot and prices) when
// this pack's currency is in use; numbers the pack writes itself (ranks, item values, prices) stay as written.
export const ECONOMY_FIELDS = Object.freeze(['scale', 'note']);
export const ECONOMY_LIMITS = Object.freeze({ min: 0.001, max: 1000, note: 500 });
export const START_FIELDS = Object.freeze(['scene', 'inventory']);
