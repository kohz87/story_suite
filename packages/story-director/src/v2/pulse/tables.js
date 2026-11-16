// Story Director v2, pulse part: the World pulse tables, the table choice by real counts, the draw order, the place
// groups and the flavour lines (pure data and pure functions; no state, no ctx, no model call).
//
// * Table: 'std' (Standard) when at least STANDARD_MIN_NAMED named people are in play and at least STANDARD_MIN_OFFSCREEN
//   of them are off-screen, else 'duo' (Duo). The caller counts: named = scene present + known NPCs + cast; offscreen =
//   open agendas + key people away + unmet cast.
// * Draw order (fixed, always three draws from ctx.rng() in this order, unused ones spent anyway, so a result never
//   shifts the draws after it): 'd20' (1 + floor(u × 20)), 'actor' (which named person, when the entry names one), 'line'
//   (which flavour line, when the entry has lines here). The same seed and state give the same result; a swipe draws anew.
// * Step-down: an entry that cannot happen here (no flavour line for the place group or weather, or no one to name)
//   steps to the next row of its table, wrapping round. CALM is in both tables and is always possible, so the walk
//   ends. A step spends no draw.
// * Place groups: an atlas place kind folds into wild, town, indoors, road or water by its words; no kind (or an unknown
//   one) is DEFAULT_GROUP.
// * Flavour lines: {name} is the actor's name and {place} the place's (fillSlots: flattened, cut, no markup). Setting-
//   agnostic wording: no pack names, currencies or factions. The effect entries (ENTER_CHECK, GOSSIP_SURGE,
//   CHANCE_MEETING, OVERHEARD_DETAIL, TASK_SHIFT) have no lines here: effects.js builds their text and payloads.
// Public face: re-exports its parts.

export { STANDARD, DUO, STANDARD_MIN_NAMED, STANDARD_MIN_OFFSCREEN } from './tables-parts/table-ids.js';
export { DRAW_ORDER, d20Of, pickIndex, drawsFrom } from './tables-parts/draws.js';
export { PLACE_GROUPS, DEFAULT_GROUP, placeGroupOf } from './tables-parts/place-groups.js';
export { SLOT_MAX, plainSlot, fillSlots } from './tables-parts/slots.js';
export { TABLES } from './tables-parts/table-rows.js';
export { QUIET_FALLBACK, QUIET_SPREAD, ACTOR_NEEDS } from './tables-parts/kind-rules.js';
export { FLAVOUR } from './tables-parts/flavour-data.js';
export { weatherOf, flavourLines, flavourFor } from './tables-parts/flavour-lines.js';
export { tableFor, possibleKind, resolveKind } from './tables-parts/table-choice.js';
export { INTENSITIES, intensityOf, briefFor } from './tables-parts/intensity.js';
