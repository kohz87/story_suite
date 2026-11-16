// Return in time (MODULES §F17): `sdk.rewind({ index, beforeRev })`.
//
// The chat is branched at carrier `index` with SillyTavern's own branch (the old timeline stays as it
// was, in its own chat file), the branch is opened, and on the branch that carrier's receipts with
// rev >= beforeRev are dropped together with their ops (store.truncate). The head is then the state just
// before the first dropped receipt, and the next command commits on that carrier.
//
// How the branch is made, first that works:
// 1. `ctx.branchChat(index)` when the context has it (the testkit's fake does; SillyTavern 1.19 does not
//    put it on getContext());
// 2. `branchChat(index)` from SillyTavern's own /scripts/bookmarks.js (1.19: creates the branch file from
//    chat[0..index], saves it, opens it; resolves to the file name or null);
// 3. the `/branch-create <index>` slash command through ctx.executeSlashCommandsWithOptions (same function
//    behind it).
// Each of them leaves the branch open as the current chat (CHAT_CHANGED fires, the turn rebuilds).
//
// Nothing is branched unless the changes can be taken back (B-b2-timeline-8): the truncation is worked
// out on the chat as it is first (store.truncate's dry run). If it still fails on the branch, the chat
// the reader was in is opened again (`reopen`, SillyTavern's openCharacterChat / openGroupChat).
// Public face: re-exports its parts.

export { stBranch, stReopen, stCreateBranch } from './rewind-parts/st-branch.js';
export { STILL_WAITING_MS } from './rewind-parts/shared-limits.js';
export { createRewind } from './rewind-parts/rewind.js';
export { SAVEPOINTS_FEATURE, SAVEPOINT_LIMITS, createSavePoints } from './rewind-parts/save-points.js';
