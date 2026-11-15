// Field names and limits of a pack's weather table.

// A pack's weather table (MODULES §F122), read by a module that sets the weather by rule (Story Director):
// `{ seasons?: [{ name, months }], tables: [{ season?, region?, weather: [text] }] }`.
export const WEATHER_FIELDS = Object.freeze(['seasons', 'tables']);
export const WEATHER_SEASON_FIELDS = Object.freeze(['name', 'months']);
export const WEATHER_TABLE_FIELDS = Object.freeze(['season', 'region', 'weather']);
export const WEATHER_LIMITS = Object.freeze({ seasons: 12, months: 60, season: 24, region: 80, tables: 120, kinds: 24, text: 60 });
