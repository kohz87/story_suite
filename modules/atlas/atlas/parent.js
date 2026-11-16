// Story Director v2, atlas part: a place's parent and its coordinates (pure).
//
// A place the story names as part of another ("Auvoth (Southern Gatehouse)", "Auvoth / Pale Market", "Pale Market in Auvoth",
// "Bluewatch Watchhouse") sits in that parent. parentOf reads the parent from the name; the parent resolves through the joined
// world (worldOf's `{ places, find }`), and the caller creates it when it does not. childOffset gives a child a small fixed offset
// from its parent (the angle from a hash of the child's key, so the same on every read and replay). regionAnchor gives a place with
// no parent the middle of the placed places of its region. placeLine writes "Town · Spot". settlePlace and tidyPlaces are the two
// writers: they save `parent` and x/y on atlas places (the caller's ensurePlace makes a missing parent). Nothing reads
// a clock or a random source. The caller keeps a pack place as it is: parentOf splits any name it is given.
// Public face: re-exports its parts.

export { parentOf, placeLine } from './parent-parts/resolve.js';
export { childOffset, regionAnchor, settlePlace, tidyPlaces } from './parent-parts/settle.js';
