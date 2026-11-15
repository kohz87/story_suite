// Story Director v2, part **keypeople** (USER, 1 Nov): the people {{user}} follows. Story Director owns the list.
//
// * Feature `story-director.key-people` (on by default, no preset turns it off: Lean keeps it; not part of the World-building
//   threads feature). Off means fully off: no kind, line, command, query or screen, nothing in the prompt; what is stored stays.
// * State: the `keypeople` domain (domain.js): who is pinned, each pinned person's away record (what they do, since when, due
//   back when, the steps of their timeline), who was taken off the list and why. Replay-safe like every domain here.
// * Narrator: kinds `away` and `key` (capture.js): `+ away Ren — scouting the north road | back: <date>`, `! away Ren — reached
//   Wolfmere Outpost`, `- away Ren` (back), `- key Ren | died`. Only a pinned person may be away. The tail (note.js) tells one
//   line per away key person within the token budget; a back date that passes moves nobody ("due back").
// * Removal: a pinned person NPC State Delta has archived or lost (a death) leaves the list before the next reply, with the
//   reason (nsd.js, the hook below); the story's `- key Name | died` and the reader's Unpin do the same. Never written to NSD. NSD's
//   removal is stored on the reply before the one being written, but its card line goes on the reply that followed (`keypeople.tell`).
// * Reader: World → Now's Key people section (widget.js, the world part's screen) pins and unpins (cause `ui`).
// * Interface for other modules: the query `director.keyPeople` (queries.js). Settings: how many key people (10) and the
//   narrator budget for them (300 tokens, no upper limit).
// Works without NPC State Delta (a death is the story's line, or Unpin).
// Public face: re-exports its parts.

export { FEATURE } from './domain.js';
export { KEY_PEOPLE_WIDGET } from './widget.js';
export { capOf } from './capture.js';
export { tokensOf } from './note.js';
export { beforeGenerate, afterCapture } from './index-parts/hooks.js';
export { part } from './index-parts/part.js';
