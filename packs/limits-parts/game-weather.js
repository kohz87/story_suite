// Pack format 4, the game pack's weather: the styles, the table fields and the limits.

// `style`: where the weather comes from. `climate` (built-in tables by climate and season, the default), `tables` (the pack's own tables) or `story` (the narrator alone).
export const GAME_WEATHER_STYLES = Object.freeze(['climate', 'tables', 'story']);
// A table is `{ climate?, season?, weather: [text] }`; format 3's `region` is gone (a game pack does not know the world).
export const GAME_WEATHER_TABLE_FIELDS = Object.freeze(['climate', 'season', 'weather']);
export const GAME_WEATHER_LIMITS = Object.freeze({ tables: 120, season: 24, kinds: 24, text: 60 });
