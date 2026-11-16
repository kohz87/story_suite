// Story Director v2, part **cast**: the rules that decide who moves and who crosses the party's path (pure apart from the queries
// a frame is built from). No dice: a meeting follows from place and routine, or from a goal the story touched.
//
// * The cast moves only when the story day changes or a stretch of time passes (`dueMove`): one batch, from the story minute the
//   cast was last moved to the clock now.
// * A first meeting (`chooseMeetings`), at most one a reply, never during a fight, within the "new faces at most" pace:
//   - by place: the party is at the person's place (its place or the town it stands in, `atPlace`; a region alone is not) while their routine has them there (their entry's `routine` names a time of
//     day; one that names none holds at any hour; a person who has moved away from their start has no routine to keep);
//   - by goal: the planner judged that a phrase of their `drawnTo` is touched by the story and cites the reason.
//   - sought: the reader's message looked for a kind of person and the planner named this one, citing words that stand in the message (or
//     the story's last reply) as whole words (plan.js, sought.js): met at once when they are at the party's place, else a RUMOR (no meeting:
//     `chooseRumor`, one line that describes them and never names them, told once until they move).
//   Goal meetings come first (they carry a reason the story gave), then sought, then place meetings in the order people joined the world.
// * A goal pulls someone only with a real link (`linkOf`: the party's place is a place their goal names, an open thread names them or
//   their faction as giver or people, or the party carries what their goal needs); a word the goal and the scene share is none. And
//   someone can arrive only if they are at the party's place or town or the story time since they were placed covers the atlas's road
//   trip, and the trip from their last known place too after a hop with no road (`canReach`; a straight-line estimate or no road = far).
//   A linked person who is too far sets out instead (`sortComes`: a journey, `person.coming`, landing after the real trip time, dropped
//   when the link goes). The pulse's chance meeting (`reach: 2` and `3`) and the planner's moves (`moveReach`) follow the same reach rule.
// * A meeting counts only if the reply shows the person (`unshown`, after the reply: `cast.withdraw`): the narration (not its hidden
//   comments) names them (name or alias, whole word) or a `+ present` line does; else they stay unmet, the pace is not used up and
//   they may come again later. Someone met in the story is no planned meeting and is never withdrawn.
// * People the narrator already has in the scene (present), people the reader pinned as Key people, the dead and people whose pack
//   is not enabled now are left alone.
// Public face: re-exports its parts.

export { PER_REPLY, paceOf, roomLeft } from './world-parts/pace.js';
export { SKIP_MINUTES, dueMove, placedOf } from './world-parts/schedule.js';
export { batchKey, fingerprint, judgeKey } from './world-parts/keys.js';
export { askedAbout, movable, nearCount, refsOf } from './world-parts/movable.js';
export { atPlace, daysBetween, reachDays } from './world-parts/places.js';
export { holds, linkOf } from './world-parts/links.js';
export { canBeHere, canReach, moveFits, moveReach } from './world-parts/reach.js';
export { chanceCandidates, sortComes } from './world-parts/comes.js';
export { chooseMeetings, chooseRumor, metInTheStory, seekable } from './world-parts/meetings.js';
export { namedIn, unshown } from './world-parts/shown.js';
