/* NPC State Delta NPC name-in-text matching: title/common-word tables, whole-word matching and
   normalized phrase counts used by scan presence and scene matching. Split from core-merge.js
   without change; core-merge.js keeps the public exports. Never imports core-merge.js.
   Public face: re-exports its parts. */
export { npcNamedInText, countNormalizedPhrase } from './core-merge-names-parts/name-in-text.js';
export { partialNamePair, placesOverlap, identityConflict } from './core-merge-names-parts/identity-conflict.js';
