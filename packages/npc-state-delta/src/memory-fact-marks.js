// Memory facts (design MEMDESIGN2 §5, amendment 3): the live-eligibility marks. The setting `memoryFacts` (default on; off means no fact is derived,
// no prompt text is added and no mark is written) names the rule. A mark is the exact lineage checkpoint key of an assistant reply that arrived as a
// genuinely NEW live reply with the setting on (never a Re-read, load, Refresh, manual scan, replay or old/cast/manual admission). Facts are derived only
// for a reply whose current key is marked. Old chats carry no marks, so they stay byte-identical until a new live reply.
//
// Restore rule (the narrow exception to exact-boundary restore): marks live at chat-state level, outside branch snapshots, so a rewind or
// pre-upgrade restore keeps them untouched (`restoreSnapshotIntoState` spreads the current state). They can only ever authorise the exact key
// they were written for: a key binds the reply's content and its parents, so a rewind below the upgrade point, a reply regenerated at a lower index
// and a content-identical sibling on another branch all have other keys (or none) and are never marked by the union. Payloads, ledgers and cursors are
// never carried here. Bounded: the newest MARK_LIMIT keys, oldest dropped (a dropped mark means no fact, never a guess).
// Public face: re-exports its parts.
export { MARK_LIMIT, memoryFactsOn, markedKeys, isMarked } from './memory-fact-marks-parts/mark-keys.js';
export { markLiveReply, unionMarks } from './memory-fact-marks-parts/mark-write.js';
