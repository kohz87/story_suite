// Choices and Inner chatter: the reader's chatter cap and the cuts of a thought and a name.

import { CHATTER_MAX } from './limits.js';

/** The reader's setting (Most chatter lines per reply): 1 to CHATTER_LIMIT, CHATTER_MAX when unset. */
export const CHATTER_LIMIT = 10;
export function chatterCap(value) {
    return Number.isInteger(value) && value >= 1 && value <= CHATTER_LIMIT ? value : CHATTER_MAX;
}

export const CHATTER_CHARS = 240;
export const NAME_CHARS = 40;
