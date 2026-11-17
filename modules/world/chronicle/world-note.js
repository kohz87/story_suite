// Story Director v2, chronicle part: the world note (job F), built by code each reply while the feature
// `story-director.world-events` is on (default off; off means no line, no budget change, nothing).
//
// Up to about 160 tokens in place of the [World] lines (seam audit E23: they overlap, so they are retired while the switch is on):
// the scene's place status, the conditions that hold here with what they mean and their told prices (`chronicle.conditions` at the
// scene), the two most recent world entries whose news has reached the scene's place (`world.heardHere`; one still rumour at this
// place reads "Title (rumour) — …"), and the world happening that fired here today (`world.cueToday`). Its lines are pinned. It reads
// only those queries and the state, so a swipe, a middle delete, a rewind, a reload and an edited Re-read give
// the same note for the same state. A host or a part that is not there is just a note with fewer lines.
// Public face: re-exports its parts.

export { WORLD_EVENTS_FEATURE, WORLD_NOTE_BUDGET, worldEventsOn } from './world-note-parts/feature.js';
export { WORLD_NOTE_HEADER, effectsText, noteText, worldNote } from './world-note-parts/build.js';
