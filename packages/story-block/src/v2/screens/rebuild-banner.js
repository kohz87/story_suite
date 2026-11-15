// Home's "This branch's dossiers can't be restored" banner (screens/rebuild-banner.js) and the confirmation dialog
// that starts a branch's dossiers again from the chat. It is the `story-block.rebuild-banner` host widget: a banner
// only while the timeline holds a PERMANENT dossier failure, a two-choice dialog (the last 40 replies, the default,
// or the whole chat), progress while the participant reads, and a dismissible one-line note when it is done. A
// transient failure (still being retried) draws nothing. Text is set with textContent; the words are the approved
// Home mockup's.
//
// `props.inline` / `props.open`: the Inspector's Problem row mounts this widget with both, so its button opens the same confirmation.
//
// The catch-up states (mockup section D) come from the participant's synchronous `catchUp()` read (timeline `host.progress()`:
// { module, active, done, total, older, from, reason, outcome, message }): while it is reading, the working banner for a rebuild (section B,
// the real count) or the catch-up banner with Skip and its confirmation (`skip(module)`); when it ends, a one-line dismissible note (done,
// or stopped). `replyOf(messageIndex)` turns the scan marker into the reply number the reader counts. The banner polls `catchUp()` through
// `every(fn, ms)` (→ a stop function) only while something is reading.
//
// ui-host.js passes `blocked()` (the timeline's current block: { reason, code, blockedBy: { module, code } } or
// null), `rebuild(module, { read })`, `progress()` ({ reply, total } or null), `last()` (the last rebuilt result) and
// `dismiss(result)` (optional). It redraws on the host's head, committed, turn, feature and timeline events.
//
// Public face: re-exports its parts.

export { REBUILD_BANNER_WIDGET, REBUILD_READ_LAST, REBUILD_READ_ALL, REBUILD_PERMANENT_CODES } from './rebuild-banner-parts/constants.js';
export { rebuildTarget } from './rebuild-banner-parts/target.js';
export { REBUILD_TEXT, createRebuildBannerWidget } from './rebuild-banner-parts/widget.js';
