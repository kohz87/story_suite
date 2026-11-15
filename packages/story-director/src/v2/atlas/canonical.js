// Story Director v2, atlas part: the canonical place (contract §3 P24, "Canonical resolution"). Pure.
//
// One identity per place for every module that keys on a place (such as a map or another module's place data):
//   * a pack place is its content definition id (`pack.<id>/<slug>`), **before and after** the story materializes it as a `pl_` place;
//   * a place no pack has is its own `pl_` id, mapped to itself;
//   * a name that more than one pack's place answers to, or an own place that matches several packs, is **ambiguous**: null, held until
//     the player binds it (`atlas.placeBind`). Every pack candidate is inspected before names are made unique.
// An identity once established (`atlas.placeRefs`) never changes. `pack:<key>` is the map's node id, not an identity: it resolves to the one
// definition of that key or to nothing.
// Public face: re-exports its parts.

export { byKey, candidatesOf, keysOf } from './canonical-parts/candidates.js';
export { canonicalOf, definitionsFor, placeOfDefinition, recordRef } from './canonical-parts/resolve.js';
