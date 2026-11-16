// Story Director v2, part **atlas**: the `atlas` domain's shape, validator and name index (pure).
//
// atlas = {
//   places: { [id]: { id, name, region, kind, layer, x?, y?, discovered, rev, made? } },
//   routes: { [id]: { id, from, to, kind, days?, hours?, made? } },
//   keys:   { [keyOf(name or alias)]: placeId },
//   focus:  null | placeId | 'pack:<key>',        // the place the reader picked on the map
//   regions:      { [rg_ id]: { id, name, aliases } },              // the reader's regions (policy.js); never made from a place's text
//   placeRegions: { [canonical place id]: rg_ id },                 // explicit membership only
//   placeRefs:    { [pl_ id]: canonical place id },                 // pl_ -> the pack's content id, or itself for a place no pack has (canonical.js)
//   danger:       { world: AreaPolicy|null, regions: {rg_: AreaPolicy}, places: {canonical id: AreaPolicy} }
//   writes:       { [write id]: { fingerprint, result } }           // the retry ledger of the new writers (../writes.js)
//   tripRest?:    true                                              // set by the first reply generated on a build whose trips rest (atlas.mark); a trip line reads it
//   trips?:       { [<sid>.<n>]: trip record }                      // the trip (feature story-director.trip): absent until one is made (trip.js, trip-shape.js)
// }
// The last five arrived with contract P24; an older save has none of them and reads them as empty.
// Places and routes from enabled packs (`packs.content`) are not copied in: they are read live
// (world.js) and show as known but undiscovered until the story goes there, when `atlas.visit`
// adds the place here.
// A place is known by its name and every name it was reached by (a rename keeps the old one as
// an alias). `discovered` is false for a place only a route line named, until the story goes
// there or describes it. `layer` is the place's plane ("underground"), '' on the surface.
// Numbers are whole (SPEC §2.1, and the host keeps a whole number whole): coordinates in map
// units, a route's time in whole days and hours. `made` is the reply whose lines added the place or
// route (its record ID, Story Block's ctx.carrier.sid): a reply's new ones are counted from it
// (capture.js NEW_PER_REPLY), so no count is kept that a deleted reply could leave wrong (B-b1r2-7).
// Public face: re-exports its parts.

export { MAX_NAME, PLACE_ID, ROUTE_ID, initialAtlas } from './domain-parts/shape.js';
export { MAX_ALIASES, MAX_REGIONS, PACK_NODE, REGION_ID } from './domain-parts/policy-limits.js';
export { isRecord, newId, revOf } from './domain-parts/ids.js';
export { cleanName, cleanWord, keyOf } from './domain-parts/text.js';
export { childOffset, findPlace, orderedPlaces, round3 } from './domain-parts/places.js';
export { orderedRoutes, routeHours, routesBetween } from './domain-parts/routes.js';
export { CANONICAL_ID, areaPolicyProblems, validateAtlas } from './domain-parts/validate.js';
