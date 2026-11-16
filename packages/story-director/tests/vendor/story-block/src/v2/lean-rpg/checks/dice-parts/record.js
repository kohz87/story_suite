// The `rpg.dice` handler: draws the reply's dice and keeps them with the recorded rules and table.

import { LIMITS, PRACTICE } from '../../names.js';
import { replyDice } from './roll.js';
import { diceOf, tableOf } from './recorded.js';
import { rulesOf } from './shared-checks.js';

/**
 * `rpg.dice { rules, dc, perUse, table }`: the prelude's handler. The dice come from the receipt's seed (a swipe draws anew, a Re-read keeps them); the rules and
 * the table are the payload's, recorded as they were when the reply was sent. The note is told from this record (cue.js), never stored as text.
 */
export function diceRecord(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'The dice are rolled by Story Block before a reply, not by an action.');
    const list = replyDice(Math.floor(ctx.rng() * 4294967296) >>> 0);
    const kept = diceOf({ list, rules: payload?.rules, dc: payload?.dc, perUse: payload?.perUse }) ?? diceOf({ list, rules: rulesOf(null), dc: { ...LIMITS.dc }, perUse: PRACTICE.perUse });
    return { summary: '', narrate: false, replan: true, data: { v2: { dice: { v: 1, ...kept, table: tableOf(payload?.table) } } } };
}
