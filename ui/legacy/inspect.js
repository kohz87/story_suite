// The state inspector's data (MODULES §F92): read-only views of what the chat's story records hold,
// for the Inspector screen (src/v2/screens/inspector.js). Nothing here writes: it reads the store's
// replay (`at`, `before`, `opsAt`) and the records on the messages.
//
//   replyList(chat, { head })              the replies that keep the story, newest first
//   inspectReply({ store, chat, index, problems })
//                                          one reply: its state, the state before it, what changed
//                                          (diffStates), its ops, its receipts and its problems
//   diffStates(before, after)              [{ kind: 'add' | 'remove' | 'change', path, before, after }]
//   matchPaths(value, query)               the JSON Pointers a search finds, and the ones on the way
//   pointer(parent, key), preview(value)   helpers the screen shares
//
// Everything a reply holds came, at one remove, from the model's text, so the screen shows it with
// textContent only; here it is only read and cut to size.
// Public face: re-exports its parts.

export { LIMITS, pointer } from './inspect-parts/shared.js';
export { preview } from './inspect-parts/preview.js';
export { diffStates } from './inspect-parts/diff.js';
export { matchPaths } from './inspect-parts/search.js';
export { replyList } from './inspect-parts/reply-list.js';
export { receiptView, inspectReply } from './inspect-parts/reply-view.js';
export { createInspectorSource } from './inspect-parts/source.js';
