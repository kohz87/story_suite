// The `fishing-activity` module definition (SPEC §6): the `fishing` domain, the three commands, two
// queries and the Fishing tab. Everything here goes through the public sdk shapes only: handlers get a
// `ctx` (SPEC §3.2) and never touch Story Block's internals.
//
// A cast is two commands, both deciding nothing the reader can change:
//   fishing.cast  { spot?, bait? }        opens a line: its seed decides the fish AND the bite timing,
//                                         kept on the session; nothing is granted, nothing narrated.
//   fishing.reel  { session, hooked }     the reader's press, as a flag. Hooked: the session's fish is
//                                         granted (inventory.grant) and logged, narrated once. Missed:
//                                         nothing is granted. Uses no randomness of its own, so the
//                                         outcome depends only on the cast's seed and the flag.
//   fishing.release { catch }             puts a logged catch back (inventory.consume).
// Public face: re-exports its parts.

export { MODULE_ID, VERSION, LOG_SIZE, SESSION_KEEP } from './module-parts/constants.js';
export { initial, validate } from './module-parts/validate.js';
export { anglerName } from './module-parts/shared-ask.js';
export { cast, normalizeSpot } from './module-parts/cast.js';
export { reel, release } from './module-parts/reel.js';
export { fishingModule } from './module-parts/definition.js';
export { WIDGET_PROPS, widgetProps, fishingProps, currencyOf } from './module-parts/widget-props.js';
