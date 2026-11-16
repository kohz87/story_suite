// The room a story has for blocks, old and current.
import { DM_LIMITS } from './limits.js';
import { freeze } from './shared-freeze.js';

/**
 * The room a story has for blocks: its own (`definitions`) and all active (`pins`). A reply captured before the `partyRoom` rule mark
 * (turn/rule-marks.js) keeps the earlier 8 and 16 on a Re-read, so an old refused join stays refused; every other caller gets the current room.
 * Bytes (`pinsBytes` 262144) cap it too: a companion's two blocks are about 29 KB, so about 8 fit by size before the block counts.
 */
export const DM_OLD_ROOM = freeze({ definitions: 8, pins: 16 });
export const dmRoom = ctx => (ctx?.cause === 'story' && ctx?.carrier && !ctx.carrier.rules?.includes('partyRoom') ? DM_OLD_ROOM : freeze({ definitions: DM_LIMITS.definitions, pins: DM_LIMITS.pins }));
