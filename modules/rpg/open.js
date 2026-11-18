// Foes a fight opens (the foe pre-check's packs, board/precheck.js): `openFoes` fills a free foe slot of the Foes blocks through the block's own
// `set-slot-N` kind as part of the reply's fight step (the `rpg.board.openFoes` call, board/changes.js), so a swipe opens again, a Re-read keeps it,
// deleting the reply takes it back and a rebuild, the live state and a reload agree. `isNamedIn` is the name rule the pre-call reads a typed attack by.
// Pure except openFoes, which writes the domain it is given (the transaction's draft, or a copy to look ahead).
// Public face: re-exports its parts.
export { OPEN_RECORD_MAX_COUNT, OPEN_MAX_NAME } from './open-parts/limits.js';
export { isNamedIn } from './open-parts/named.js';
export { openFoes, FIX_VERSION } from './open-parts/fill.js';
