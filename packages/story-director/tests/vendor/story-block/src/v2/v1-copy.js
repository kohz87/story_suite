// An old copy of Story Block (version 1) enabled next to this one: its own prompt tells the model to end every reply with
// v1's `<!-- STORY_BLOCKS_V1 … -->` envelope (which the model then writes instead of, or beside, the <Changes> block), and
// both name the same generate interceptor. Told once as one plain Problems line (and a notice) while it is running; nothing
// is said once it is disabled (a page loaded without it never sees either sign).
//
// The signs are v1's own, so nothing else sets them off: its public object, `globalThis.StoryBlock` with `apiVersion: 1` and
// v1's block functions (v2's has `apiVersion: 2` and an sdk), seen before this file set its own or put back over it later;
// and its settings drawer, whose element ids v2 never uses (v1's entry file, `index.js` on the `v1` branch). A legacy envelope in a chat is no sign: chats
// made while v1 ran keep theirs after it is gone.
//
// Public face: re-exports its parts.

export { hasV1Settings, isV1Api } from './v1-copy-parts/v1-signs.js';
export { V1_COPY_CODE, V1_COPY_PROBLEM, createV1Watch } from './v1-copy-parts/v1-watch.js';
