// Story Director v2, chronicle part: receipt filtering sets and quiet/echo predicates. Pure.

import { DIGEST } from './digest-constants.js';

// Receipts that are bookkeeping only: never a fact of the day.
const QUIET_TYPES = new Set([DIGEST, 'chronicle.note', 'chronicle.surface', 'director.seed', 'director.pulse']);
// The arc planner's commands (arc/commands.js): what was planned stays behind the scenes, so an arc's
// name and counts are never a fact of the day (the Journal shows only what {{user}} knows).
export const PLANNED_TYPES = new Set(['director.arc.accept', 'director.arc.update', 'director.arc.end']);
// The reader's progress is told although the code makes it (cause system): practice lines, and the fight board's result ("Fight won: …",
// Story Block writes it as a system receipt that is not narrated), which is a fight of the day.
const SYSTEM_BUT_TOLD = new Set(['rpg.practice', 'rpg.fight']);
export const quiet = receipt => QUIET_TYPES.has(receipt.type) || (receipt.cause === 'system' && receipt.narrate !== true && !SYSTEM_BUT_TOLD.has(receipt.type));
// Receipts a section of the digest already tells (places, money, world), or the reader's own edits and
// a fight's blow-by-blow: never repeated under "happened".
export const TOLD_ELSEWHERE = new Set([
    'capture.place', 'capture.coin', 'capture.world', 'capture.faction', 'wallet.receive', 'wallet.pay',
    'atlas.visit', 'atlas.edit', 'atlas.focus', 'chronicle.edit', 'chronicle.remove', 'combat.act',
]);
// A tracker line's receipt repeats the line itself ("Director: + quest …"): the model's words, not code's.
export const ECHO = /^Director: /;
