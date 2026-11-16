// The timeline coordinator's rebuild half (docs/v2/TIMELINE.md; the owner's decision for a permanently blocked
// branch): a branch whose dossiers cannot be brought to the selected head may start them again from the chat.
// The reader chooses the last 40 replies (the default) or the whole chat. The pending selection is closed as
// `rebuilt` with `slots[module] = { rebuilt: true }`, the module's selected checkpoint is dropped, and the
// participant is asked once to rebuild. The journal entry is the only record: an old chat never calls this, and a
// chat that was rebuilt replays with the selection its participant published afterwards.
//
// `createRebuild(s, deps)` is given the timeline's state holder `s` and the coordinator functions it calls; it
// never imports coordinator.js. The participant callback needs the head and its own native mutation, so the
// barrier is taken down after the journal is durable and before the callback; `release` puts it back on its
// settled state afterwards (and is the only caller of the participant's own publication).
// Public face: re-exports its parts.

export { REBUILD_DEFAULT_REPLIES, REBUILD_READ_LAST, REBUILD_READ_ALL, REBUILD_CODES } from './coordinator-rebuild-parts/constants.js';
export { REBUILD_PROBLEM_CODE, readPlan, replyNumberAt, rebuildMessage } from './coordinator-rebuild-parts/plan.js';
export { createRebuild } from './coordinator-rebuild-parts/run.js';
