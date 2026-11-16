// Replay-only since 2.25.0 (old planner records). A fight opened by the pre-call (stage 47): the planner could list foes that are not on the Foes block yet (`foe <name> | new |
// count: n | class: X`) when the reader's message starts a fight against them. Code checks each one (vetOpen) and, only
// when the plan is rolled, fills a free foe slot through the block's own `set-slot-N` kind (openFoes), as part of the
// `rpg.resolve` step on the reply, so a swipe plans again, a Re-read keeps it, deleting the reply takes it back and a
// rebuild, the live state and a reload agree. The accepted foes travel in the plan as `plan.open`:
//     open: [{ name, count (1–12), level (1–99) | rank (a name) with from, to (its band, 1–99) | nothing more }]
// A foe with no `level` gets one when the plan is rolled (resolve.js): a seeded level inside the rank's band, or within ±2 of the party's average level.
// (A plan made before the Levels rules has `class` (1–9) instead and is read as it was.)
// Pure except openFoes, which writes the domain it is given (the transaction's draft, or a copy to look ahead).
// Public face: re-exports its parts.
export { OPEN_MAX_COUNT, OPEN_RECORD_MAX_COUNT, OPEN_MAX_NAME } from './open-parts/limits.js';
export { distinctiveWords, isNamedIn } from './open-parts/named.js';
export { vetOpen } from './open-parts/vet.js';
export { openErrors } from './open-parts/errors.js';
export { openFoes, FIX_VERSION } from './open-parts/fill.js';
