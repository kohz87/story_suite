// Foe members and packs for a board fight.
// A filled slot of 2..5 foes becomes numbered bars; 1 stays a real lone foe and 6 or more become evenly split packs of at most 12. A fight opened under the
// six-group rule (`setup.foesSix === 1`, passed here as `six`) takes 2..6 as bars and 7 or more as packs, and a full pack attacks 1 + floor(count / 2) times (at most 6);
// a fight without it keeps cap 5 and 1 + floor(count / 6) (at most 3), exactly as before. These helpers only
// turn the real Foes block into virtual bars and back, so the engine can keep its own values and write ordinary moves.
// Public face: re-exports its parts.

export { MEMBER_CAP, MEMBER_CAP_SIX } from './members-parts/shared-caps.js';
export { PACK_MAX_SIZE, PACK_MAX_ATTACKS, PACK_MAX_ATTACKS_SIX } from './members-parts/pack-limits.js';
export { memberSize } from './members-parts/member-size.js';
export { packSize, packLeft, packCounts, packAreaBlocks } from './members-parts/pack-bars.js';
export { packFullAttacks, packAttacks } from './members-parts/pack-attacks.js';
export { virtualSlot } from './members-parts/shared-slots.js';
export { splitFoes, carriedFrom } from './members-parts/split-foes.js';
export { collapseFoes } from './members-parts/collapse-foes.js';
export { attackList, capAttackers } from './members-parts/attacks.js';
export { boardFoes } from './members-parts/board-foes.js';
