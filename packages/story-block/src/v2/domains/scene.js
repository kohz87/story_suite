// The `scene` domain (§7): where the story is, who is present, the weather and what {{user}} wears and how they
// are, with its validator, commands, capture kinds `place`, `present`, `weather` and `you`, queries and prompt view. Pure.
// The parts live in scene/ (constants, shared, present, place, weather, you); this file keeps the validator, the command and
// query tables and the tail, and re-exports every name the scene always exported, so importers keep this path.
// Public face: re-exports its parts.

export { WEATHER_CHARS, WEATHER_TAIL_CHARS, WEATHER_KEY_CHARS, WEATHER_FEATURE, YOU_CHARS, YOU_FEATURE, YOU_SHORT_CHARS } from './scene/constants.js';
export { capturePresent } from './scene/present.js';
export { capturePlace } from './scene/place.js';
export { captureWeather, weatherText } from './scene/weather.js';
export { captureYou, youParts, youText, youNote } from './scene/you.js';
export { initialScene, validateScene } from './scene-parts/state.js';
export { sceneCommands } from './scene-parts/commands.js';
export { sceneQueries } from './scene-parts/queries.js';
export { sceneTail } from './scene-parts/tail.js';
