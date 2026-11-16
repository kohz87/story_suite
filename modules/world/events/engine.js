// Pack events (SPEC §9, MODULES §E): `{ id, when, cue, once = true, after?, then? }`.
//
// Before each reply (`beforeGenerate(view)`, SPEC §4.1 step 3) every enabled event is checked against
// the head state, in id order. An event is due when its `after` event has happened (its claim is on
// this line of history) and its condition is true. A due event is committed as one `system` command,
// `events.fire`, whose receipt summary is the cue: the next reply is told it as an untold receipt, so
// nothing goes to the tail. The same transaction claims `event:<id>` (once events) and runs the
// event's `then` commands through `ctx.call`, so either all of it happens or none of it does.
//
// Whether an event has happened is read from `meta.claims` only, never from memory: swipe or delete the
// carrier that holds the claim and the event can happen again; replay and rebuild agree by construction.
// A chain (`after`) moves at most one link per reply, because every event is checked against the same
// view the reply started from.
//
// Public face: re-exports its parts.

export { FIRE, EVENT_LIMITS, claimKey, repeatKey } from './engine-parts/shared-keys.js';
export { normalizeEvents } from './engine-parts/normalize.js';
export { inspect } from './engine-parts/inspect.js';
export { createFireEvent, fireEvent } from './engine-parts/fire.js';
export { createEngine } from './engine-parts/run.js';
