// The `scene` domain's limits and feature names in one place, so every part of the scene reads the same numbers: the name and
// presence caps, the weather and {{user}}'s look (`~ you`) character caps, and the parts a look has. Pure. scene.js re-exports
// the public ones.
// Public face: re-exports its parts.

export { MAX_NAME, MAX_PRESENT } from './constants-parts/caps.js';
export { WEATHER_CHARS, WEATHER_TAIL_CHARS, WEATHER_KEY_CHARS, WEATHER_FEATURE } from './constants-parts/weather.js';
export { YOU_CHARS, YOU_FEATURE, YOU_PARTS } from './constants-parts/you.js';
