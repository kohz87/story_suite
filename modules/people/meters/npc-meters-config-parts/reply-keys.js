// The reply key a meter window belongs to and the check that a window is that reply's.
import { isInt } from './values.js';

// The longest reply record ID a meter window keeps (Story Block's are "sw_" and 12 letters).
const REPLY_ID_MAX = 64;
export const isReplyId = value => typeof value === 'string' && value.length > 0 && value.length <= REPLY_ID_MAX;
/**
 * The reply a meter window belongs to (SPEC §2.2, per-reply bookkeeping): the reply's record ID (`sid`),
 * which a middle delete never moves (B-a1-15), else its index (a host that gives no record ID); null
 * when neither is known.
 */
export const replyKey = (sid, index) => (isReplyId(sid) ? sid : isInt(index) && index >= 0 ? index : null);
// Whether the window `turn` is the reply `key`'s.
export const sameReply = (turn, key) => turn?.reply === key && key !== null && key !== undefined;
