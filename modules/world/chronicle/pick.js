// Story Director v2, chronicle part: which open world events the next reply is reminded of
// (pure apart from the command's ctx).
//
// At most three, picked by code. Each open event scores how long since it was last in the tail
// (in picks, `chronicle.round - chronicle.seen[id]`, capped; never shown counts as the cap) plus
// how near its place is to the scene's (the same place 3, a known route away 2, the same region
// 1, through the atlas's queries when they are there), plus a seeded fraction below 1 that only
// decides between equal scores. The highest three are picked. Open events a pack event's lasting change
// marked `keep` (at most two, the most recently updated: domain.js keptEvents) take their seats first and
// the rest of the three go by score; an old chat has none, so its picks are as they were.
//
// Before each reply, when more than three events are open and no pick was made for this reply
// yet, `beforeGenerate` commits `chronicle.surface` (cause `system`): it makes the pick with the
// receipt's seed (`ctx.rng()`), counts the round and records `surfaced = { at, round, ids }`. The
// tail then shows that pick; a swipe or a regenerate of the same reply finds it already made and
// shows the same events again. Replay applies the receipt's ops, so a rebuild gives the same
// pick. Without the hook (a host that runs none), the tail picks the same way with a hash of the
// head's rev and each id instead, so the same state always gives the same events.
// Public face: re-exports its parts.

export { nearness, scenePlaceOf } from './pick-parts/nearness.js';
export { STALE_CAP, TAIL_EVENTS, hashUnit, pickEvents } from './pick-parts/scoring.js';
export { pickFresh, tailPick } from './pick-parts/tail-pick.js';
export { SURFACE, beforeGenerate, surface } from './pick-parts/surface.js';
