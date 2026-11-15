// The RPG's code is loaded only when it is needed (Story Block 2.17.0, "lazy RPG").
//
// src/v2/lean-rpg/index.js (the part with the rolls, the pre-call, fight XP, practice, the companions who join and
// everything they pull in) is a dynamic import: nothing of it is fetched while the feature `story-block.rpg` is off
// and the chat holds nothing the RPG wrote. It IS fetched, before the chat is replayed,
//   - when the feature is on (at boot, or the moment the reader switches it on), or
//   - when the open chat holds the RPG's records: a stored roll, fight XP, practice or a joined companion (`holdsRpg`),
//     or a held plan / start note in the chat's metadata, so a chat with RPG receipts replays exactly as recorded
//     whatever the feature says now.
// The small helpers every block uses (names.js, blocks.js, formula.js, read.js, soul.js, tail.js, cue.js, foes.js, levels.js) stay static.
//
// This file holds: the loaded library's holder (`rpgLib`), the part's stand-in (`createLazyRpgPart`: the same commands,
// cards, queries, hooks, settings and guard as lean-rpg/index.js createLeanRpgPart, handed to the real part once the
// library is there), the loader (`createRpgLoader`) and the check of a chat (`holdsRpg`). No DOM, no SillyTavern.
// Public face: re-exports its parts.

export { holdsRpg } from './rpg-lazy-parts/holds.js';
export { rpgLib, setRpgLib, createRpgLoader } from './rpg-lazy-parts/library.js';
export { createLazyRpgPart } from './rpg-lazy-parts/stand-in.js';
