// Story Director v2, atlas part: what the model is told (pure).
//
// static: nothing of its own. The atlas's two kinds give the change-line instruction one line
// each (GRAMMAR), which Story Block writes under its `<Changes>` header (SPEC §5): fixed text.
// tail: one optional line, the known routes from the scene's place with how long each takes
// (travel.js; not the street legs between parts of the town the scene is in), within about 80 tokens; nothing when the place has no known route;
// then where places lie as the crow flies (places-line.js), within about 100 tokens.
// Public face: re-exports its parts.

export { GRAMMAR, STATIC_TEXT, TAIL_BUDGET, TRIP_TAIL_BUDGET } from './note-parts/grammar.js';
export { PLACES_TAIL_BUDGET } from './note-parts/places-line.js';
export { atlasTail, routesLine, scenePlace, tripTail } from './note-parts/tail.js';
