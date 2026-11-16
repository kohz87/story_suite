// Lookups over the enabled packs (pure). Every function takes the normalized packs in
// list order (validate.js `pack`), so the same list always gives the same answer.
//
// Order decides ties: a pack earlier in the installed list wins over a later one, for an
// item name two packs both define and for the start place.
// Public face: re-exports its parts.

export { itemDef, itemDefsIn, resolveItemIn } from './content-parts/items.js';
export { contentOf, craftsOf } from './content-parts/records.js';
export { youRankOf, calendarOf, weatherOf, economyOf } from './content-parts/tables.js';
export { ripplesOf, rippleChoice } from './content-parts/ripples.js';
export { mergeStart, applyStart } from './content-parts/start.js';
