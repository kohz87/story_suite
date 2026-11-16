// Story Director v2, part **world**: the World screen's Leads data and the fold every World section shares.
//
// * `leadsOf(state, tools)` → `[{ id, name, heard, heardAgo, where, lapses, lapsesAt }]`: the hooks the player has heard of, newest first.
//   The same filter as World's known list (known.js): active, not ended, no planner offer, no arc thread, no hidden name
//   or hidden phrase. `heard`: the hook's summary; `heardAgo`: when it was first heard; `lapses` / `lapsesAt`: the story day (text, minute) it lapses on, or '' / null for a lead that never does; `where`: its place when the hook
//   names one (fields `where` or `place`), else ''. Never its Next line. Query `director.world.leads` (index.js).
// * `foldMemory(storage?)`: which World sections the reader folded, per chat, on this device (one JSON object under
//   FOLD_STORE; every storage access is guarded and the page keeps its own copy).
// * Widget `story-director.fold` (`foldWidget`): the head of a folding section: a centred chevron, the title and the count.
//   It sits in a template section marked `data-fold="<id>"` (its body is the section's `.sd-fold-body`); a click folds or opens
//   the section and remembers that for this chat. Open by default.
//
// Text only ever goes in as text (textContent), never as markup (WAVE rule 7). The only write is the fold's remembered
// state; a blocked or full storage keeps it for the page, and the page's own copy is read first.
// Public face: re-exports its parts.

export { leadsOf } from './elsewhere-parts/leads.js';
export { FOLD_STORE, foldMemory } from './elsewhere-parts/fold-memory.js';
export { FOLD_WIDGET, createFoldWidget, foldWidget } from './elsewhere-parts/fold-widget.js';
