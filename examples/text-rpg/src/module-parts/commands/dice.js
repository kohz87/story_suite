// `textRpg.dice`: a system step before a reply; draws the reply's three dice from its seed and records them, with the floor, in its receipt.
import { drawDice } from '../../dice/record.js';
import { requireActive } from '../active.js';

/**
 * Payload: { floor, own } (`own`: the step is for the reply on the carrier it is kept on, a swipe's or a regenerate's, not for the next one). The dice live in the receipt's data (the reply's `? try` lines and the tail read them there), so they never depend on where a
 * Re-read puts a system step among the reply's ops. A swipe draws anew (a new seed); a Re-read keeps what was drawn. Never the reader's to call.
 */
export function dice(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'The dice are rolled before a reply, not by an action.');
    requireActive(ctx);
    return { summary: '', narrate: false, data: { ...drawDice(Math.floor(ctx.rng() * 4294967296) >>> 0, payload?.floor), own: payload?.own === true } };
}
