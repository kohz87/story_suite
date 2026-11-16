// History replay for NPC State Delta's restored-checkpoint fallback and "start from the chat" rebuild.
//
// createHistoryReplay(deps) owns only orchestration. Every effect outside the private state copy is injected:
//   copyState(base)                  -> a private working copy of the state (value or Promise)
//   viewFor(replyIndex)              -> the as-of view for that zero-based index in the supplied replies
//   runReply(state, view, sink)      -> the live per-reply path; sink records every outward write instead of sending it
//   stillValid(start)                -> true when the chat, lineage and head mark are unchanged since the run began
//   install(state)                   -> installs the finished copy once (value or Promise)
//   publishOnce()                    -> publishes the one native change after install
//   persistCatchUp(field | null)     -> stores { from, to, reason, attempt }; null clears it
//   progress({ done, total })        -> reports bounded replay progress
//   cap                              -> the number of newest replies to read (default 40)
//
// The sink is callable and also gives every property name as a recording method. Each call is appended to
// sink.calls as { name, args }; sink.replyIndex is the original reply index currently being replayed. Nothing
// in this module writes the live state, publishes, or forwards a Story Block operation itself.
// Public face: re-exports its parts.

export { HISTORY_REPLAY_CAP, HISTORY_REPLAY_MAX_ATTEMPTS } from './history-replay-parts/limits.js';
export { isRecord } from './history-replay-parts/shared-basics.js';
export { createHistoryReplay } from './history-replay-parts/replay-engine.js';
export { createCatchUp } from './history-replay-controller.js';
