// Where and when, for the Assist safety net (the after-reply extractor): what it is told about the scene's place and the
// story's date and time, and the two checks code makes on its answer. The extractor model tends to invent a name for a place
// the map already has ("Bluewatch Guild Branch" for "Bluewatch Village / Guild Office") and to write a time of day in words
// ("midday", "mid-morning") that no clock reads. So it is given the current place, the known names near it and the story's
// date and time, and told to use a known name and a clock time; code then refuses a `place` line whose name is not a known
// one but plainly means a place the map has, and a `time` line that sets a time without a clock time. A refusal is reported
// as a Problems line on the reply (turn.js captureAssist), never applied. Pure: no DOM, no state.
// Public face: re-exports its parts.

export { MAX_NEAR, NAME_CHARS, whereNow } from './where-parts/near.js';
export { mapPlaces, knownPlace } from './where-parts/places.js';
export { MAX_WORLD, STANCE_CHARS, worldKnown } from './where-parts/world-known.js';
export { whereLines } from './where-parts/lines.js';
export { hasClockTime, whereWhy } from './where-parts/why.js';
export { assistDepartures, assistPlaceConflict, assistPresentGuard } from './where-parts/present-guard.js';
