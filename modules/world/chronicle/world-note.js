// Story Director v2, chronicle part: the world note (job F), built by code each reply while the feature
// `story-director.world-events` is on (default off; off means no line, no budget change, nothing).
//
// Up to about 160 tokens beside the [World] lines: the conditions active at or near the scene
// (`chronicle.conditions`), the two most recent world entries whose news has reached the scene's place
// (`world.heardHere`), and the one authored cue fired today (`world.cueToday`, when a pack has one). It reads
// only those queries and the state, so a swipe, a middle delete, a rewind, a reload and an edited Re-read give
// the same note for the same state. A host or a part that is not there is just a note with fewer lines.
// Public face: re-exports its parts.

export { WORLD_EVENTS_FEATURE, WORLD_NOTE_BUDGET, worldEventsOn } from './world-note-parts/feature.js';
export { WORLD_NOTE_HEADER, worldNote } from './world-note-parts/build.js';
