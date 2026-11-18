// Story Director v2, part **time**: the day's weather by rule (Story Block MODULES §F122; pure).
//
// The model writes `~ weather` only when the weather changes, and often never, so the Status card, the Scene
// and the tail's Place line had none. Code picks one instead: right after a reply's last story line (Story
// Block's afterCapture, F121) this part asks for Story Block's `scene.weather` command (cause `system`, kept
// on that reply) when the story day or the region changed.
//
// * **Season** from the chat's calendar (`director.calendar`): a pack's `weather.seasons` names the months
//   of each season; otherwise the year is split by where the day falls in it, as on Earth's northern half
//   (the last and first twelfth of the year are the middle of winter): winter, spring, summer, autumn.
//   Without a story clock there is no day and no season: a mild table, picked by the region alone.
// * **Region**: the scene's region, else the one the atlas knows for the place (`atlas.here`), else none.
// * **Table**: the enabled pack's `weather.tables` (`packs.weather`): the season's and region's (the region by
//   name, any case, or one that contains it), else the season's for any region, else the region's for any
//   season, else one for any; otherwise the built-in temperate table for the season.
// * **Seed**: the pick is a hash of the story day and the region (FNV-1a), never Math.random or the date, so a
//   swipe, a Re-read, a rebuild and a reload pick the same weather for the same day and place.
// * **The story's word wins** for the rest of that day and place: Story Block keeps a story `~ weather` without
//   a key, and this step then only marks it with the day's key (`scene.weather { key }`, its words kept); a new
//   day or another region brings the rule's weather back.
// * Feature `story-director.weather` (on), and Story Block's `story-block.weather`: off, nothing is asked.
//   An older Story Block without the `scene.weather` command is not asked either (nothing changes there).
// Public face: re-exports its parts.

export { WEATHER_FEATURE, HOST_WEATHER_FEATURE, WEATHER_COMMAND, WEATHER_KEY_CHARS } from './weather-parts/names.js';
export { SEASONS, TEMPERATE, seasonByYear, seasonOf } from './weather-parts/seasons.js';
export { hashOf, tableFor, regionOf, weatherKey } from './weather-parts/pick.js';
export { weatherFor, weatherHook } from './weather-parts/rule.js';
