// Sizes a pack's bar, splits a count into packs, and counts the foes left or hit.

import { PACK_MAX_SIZE } from './pack-limits.js';
import { num } from './shared-numbers.js';

/** The pack's bar size: one member's bar plus one block per three foes, at most 12. */
export const packSize = (memberBlocks, count) => Math.min(PACK_MAX_SIZE,
    Math.max(1, num(memberBlocks)) + Math.floor(Math.max(0, num(count)) / 3));

/** How many of a pack's foes are about left; 0 when it is Down. */
export const packLeft = (count, value, size) => (num(value) <= 0 ? 0
    : Math.ceil(Math.max(0, num(count)) * num(value) / Math.max(1, num(size))));

/** How many foes each pack holds: packs of at most 12, evenly split, earlier packs taking the extra. */
export function packCounts(count) {
    const total = Math.max(0, num(count));
    if (total < 1) return [];
    const packs = Math.ceil(total / PACK_MAX_SIZE), even = Math.floor(total / packs), extra = total % packs;
    return Array.from({ length: packs }, (_, at) => even + (at < extra ? 1 : 0));
}

/** One roll's blocks against a pack: an area hit takes a third of its bar, plus one when decisive. */
export const packAreaBlocks = (size, decisive) => Math.ceil(num(size) / 3) + (decisive ? 1 : 0);
