// Story Director v2, atlas part: the commands and the change lines that write the atlas (pure).
//
// Commands: `atlas.visit` (the story is at a place: beforeGenerate sends the scene's place when
// the atlas does not have it yet), `atlas.edit` (the reader's corrections: a new name, the
// coordinates, the layer, the region, the kind), `atlas.focus` (the place picked on the map; a
// click on anything else changes nothing). Kinds: `route` and `landmark` lines, run by Story
// Block as story commands (SPEC §4.2). A line the rules cannot use fails with a plain sentence,
// which Story Block keeps in its problems list; nothing is saved for it.
// Public face: re-exports its parts.

export { MAX_PLACES, MAX_ROUTES, NEW_PER_REPLY } from './capture-parts/limits.js';
export { ensurePlace } from './capture-parts/places.js';
export { applyLandmarkLine, applyRouteLine, routeTime, routeTimeText } from './capture-parts/lines.js';
export { edit, focus, visit } from './capture-parts/commands.js';
