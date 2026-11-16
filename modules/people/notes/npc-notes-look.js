// The locked look of an NPC (NSDMAP2 §5): the first grounded durable look is the lock. This file holds the pure pieces the
// scan and the slice use: the drift text for a durable look the scan refused (lookDrift), the one-reply cue that goes with
// it (lookFlagWording, sent as npc.flag with narrate: true), the Problem key that dedupes it (lookFlagKey), and the stamp
// that records when the look was first set (lookLockedAt: { day, r }, restored with the appearance revert group).
// Pure: no DOM, no host, no imports; it never imports npc-meters.js.
// Public face: re-exports its parts.
export { LOOK_TEXT_MAX, lookText } from './npc-notes-look-parts/shared-text.js';
export { lookDrift, lookFlagWording, lookFlagKey } from './npc-notes-look-parts/refusal.js';
export { lookStamp, readLookStamp, stampLook, isLookLocked } from './npc-notes-look-parts/stamp.js';
