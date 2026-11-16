// The party's mounts (feature `story-block.mounts`): the animals and carts that set how fast the party
// travels, kept in the scene domain as `scene.mounts`, with the capture kind `mount`, the reader's pencil
// command, the queries `mounts.list` and `mounts.pace` (Story Director reads both) and the narrator's line. Pure.
//
// `scene.mounts` is an object of rows, absent until a reply first writes one (older chats read as none). A row
// is { name, kind, count, pace, condition, where } under a key made from its name when it was added (`m:grey
// mare`), never a list: a reply that edits a row writes that row's own fields, so a replay after an earlier
// reply was deleted still finds it (SPEC §2.2). The rows keep the order they were added in. At most MAX_ROWS.
// Public face: re-exports its parts.

export { MOUNTS_FEATURE } from './mounts-parts/feature.js';
export { MAX_ROWS, MAX_COUNT, MAX_PACE, MAX_CARRY } from './mounts-parts/caps-count.js';
export { MAX_NAME, MAX_KIND, MAX_CONDITION, MAX_WHERE } from './mounts-parts/caps-text.js';
export { WALK_PACE, DEFAULT_PACE, KIND_PACE, paceOfKind } from './mounts-parts/pace.js';
export { validateMounts } from './mounts-parts/validate.js';
export { mountRows, mountsPace, mountsTail } from './mounts-parts/rows.js';
export { captureMount } from './mounts-parts/capture.js';
export { mountsCommands } from './mounts-parts/edit.js';
export { createMountsQueries } from './mounts-parts/queries.js';
