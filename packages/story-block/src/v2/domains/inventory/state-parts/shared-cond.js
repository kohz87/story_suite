// The condition ceiling, the event limit and the clamp that the condition parts share.

// A stack's condition (gear wear): 0 (broken) to 100 (as new). It is never stored as the truth: each
// wear or repair is an event of its own, `condLog[<stack>]['<sid>#<n>'] = { d, n }` (d: the change asked
// for, −100…100; n: the rev it was written at), keyed by the reply that wrote it and only added (SPEC
// §2.2). The condition is 100 (or an older chat's plain `stack.cond`, read as where it starts) folded
// through the events in rev order, held to 0…100 at each step. Deleting a reply from the middle then
// takes exactly its events away, and nothing can go out of range. `condLog` is scratch, like perReply:
// on replay a missing piece of it is made and a drop of something gone is passed over.
export const COND_MAX = 100;
// The events one stack keeps before they are folded into one (the stack's own history is then the fold).
export const COND_LOG_MAX = 40;
export const clampCond = value => Math.max(0, Math.min(COND_MAX, value));
