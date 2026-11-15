// Story Director v2, tracker part: what fits the current scene (pure apart from the queries it asks).
//
// "Only show the narrator what could happen now": the Director note lists first the open threads the
// scene can reach, and the rest only as a few "Elsewhere" names. A thread fits the scene when
// * it is tied to the place or its region (its `place:`, `now:` or `leg:` names either, v1's place rule);
// * it is tied to someone present (its key, `giver:`, `people:`, `now:` or summary names a name Story
//   Block's scene lists as present, NPC State Delta's present list adds, or a dossier name or alias of one);
// * it is due within the reader's "Due soon" days by the story clock (due now is always told, on Due now);
// * it is a beat whose reach is met: a beat waiting on another (`after:`) that is still open never fits;
//   one whose prerequisite has ended fits, as does one whose `reach:` names the place or someone present;
// * it is a quest the story said is met or that waits only for its pay (it keeps its line), or one that
//   reads finished (the Quest check asks about it);
// * it is a clock showing signs (`shown: sign|warning`: the signs are where {{user}} is), or the reader's
//   message names it.
// With no scene known (no place, no region, nobody present) everything fits, as before.
// The rest are "elsewhere": only what {{user}} knows of (world/known.js rules: a quest taken on, a hook,
// an event; never an agenda, beat, clock or secret, nor anything the arc planner made) is named there,
// at most N of them (setting `tracker.elsewhere`, default 2), and only while the tail budget has room.
// Nothing is stored: the same state and queries always give the same answer.
//
// Public face: re-exports its parts.

export { DEFAULT_ELSEWHERE, MAX_ELSEWHERE } from './scene-parts/shared-limits.js';
export { cutPoints, flat, isRecord } from './scene-parts/shared-text.js';
export { ask, sceneOf } from './scene-parts/read.js';
export { namesPerson, wholeWord } from './scene-parts/names.js';
export { dueWithin, isDue } from './scene-parts/dates.js';
export { elsewhereCap, elsewhereItem, elsewhereLine, knownToUser } from './scene-parts/elsewhere.js';
export { splitByScene } from './scene-parts/split.js';
