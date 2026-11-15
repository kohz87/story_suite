// Story Director v2, part **time**: `director.advance`, the story clock moved on by another module's
// rule (a module action takes story time). Pure apart from the ctx.
//
// `director.advance { minutes, cause?, reason? }`, for modules and Story Block's own steps only (cause
// `story` or `system`, usually through `ctx.call` from a capture): the clock moves forward by `minutes`,
// held to 1..1440 (a day) per call, as a `~ time` line moves it (the tracker's `director.time.minutes`),
// so deadlines, the While away recap and the day digest follow it the same way. `cause` names what took
// the time (a short label: "craft"), else the calling module (`ctx.caller`); `reason` is the plain words
// the receipt tells ("Ren crafts an Iron Sword").
//
// At most one move per reply per cause: the first takes the claim `advance:<cause>:<reply sid>`
// (`ctx.carrier.sid`, which stays with the reply when an earlier message is deleted, and goes with the
// reply's own record when it is swiped or deleted). A later call for the same cause in that reply moves
// nothing and says so (`problem`): it does not fail, so the caller's own command (the craft) still
// stands. Without a reply to key on (a host step outside a capture) there is no claim.
//
// Refused from a click (cause `ui`: the reader moves the clock through the story) and while the story
// time is not set.
// Public face: re-exports its parts.

export { spanText, advanceClaim } from './advance-parts/helpers.js';
export { ADVANCE, MAX_ADVANCE, advanceCommand } from './advance-parts/command.js';
