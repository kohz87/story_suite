// The carry capacity limits and the check that only a pack's item has one.

import { isCount } from './shape.js';

// The carry capacity a def may add (PACKS.md "Carry capacity"): only a pack's item has one, so the story's
// words never make or raise it (WAVE rule 1); a carry module (`items.carry`) reads it.
export const CARRY_MAX = 1000;
// What the reader may set on an item of their own or from the story (`inventory.carry`); the story never can. 0 removes it.
export const READER_CARRY_MAX = 500;
export const packCarry = (id, value) => (typeof id === 'string' && id.startsWith('pack.') && isCount(value, 1) && value <= CARRY_MAX ? value : null);
