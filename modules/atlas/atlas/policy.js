// Story Director v2, atlas part: regions, danger and the canonical place as other modules read and write them (contract §3 P24, §5 P05).
//
//   queries   atlas.policy({})              the read-only policy projection with its hash (the `expectedHash` of every writer)
//             atlas.canonical({id?,name?})  the canonical place: id wins, neither means the scene's place; unknown or ambiguous is null
//             atlas.candidates({place})     the pack places a held place could be bound to
//             world.areaTier({place})       place -> region -> world danger; unknown holds generation (tier null)
//   commands  atlas.region, atlas.placeRegion, atlas.dangerSet, atlas.placeBind (the player's settings; idempotent by `write`)
//
// Membership and policy are explicit: nothing is read from a place's `region` text, and no writer changes membership and policy together.
// Each writer answers INVALID, then REFUSED (the issuer), then a retry of the same write, then NOT_FOUND, STALE, CONFLICT.
// Public face: re-exports its parts.

export { dangerOf, policyProjection } from './policy-parts/projection.js';
export { areaTier, canonicalQuery, candidatesQuery, queries } from './policy-parts/queries.js';
export { commands } from './policy-parts/commands.js';
