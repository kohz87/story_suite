// Atlas prompt grammar, static text, and tail token budgets.

export const TAIL_BUDGET = 80;
/** The trip's own room (feature `story-director.trip`): "On the road: …" with a few stages to come, and the reached-a-place cue. */
export const TRIP_TAIL_BUDGET = 90;

/**
 * The atlas kinds' grammar: the route line carries the landmark's (one line for the family; the landmark has none of its own),
 * and both are taught only while the story has a route or a landmark (the lean diet, 3 Nov). The trip line only while a route is known.
 */
export const GRAMMAR = Object.freeze({
    route: '+ route Place — Other Place | hours: 2 (or days: 1.5) | kind: road|river|trail|sea (- route Place — Other Place when it is gone); + landmark Name | region: where | kind: town|ruin|cave|… | plane: underground (only off the surface)',
    landmark: '',
    trip: '~ trip Place | by: riding|foot|wagon|boat|ship | via: Stop, Stop (the party sets out by the known routes; ~ trip stop; ~ trip delay: 1 day | because: lame horse)',
});

/** The atlas's part of the static prompt: none beyond its kinds' grammar. */
export const STATIC_TEXT = '';
