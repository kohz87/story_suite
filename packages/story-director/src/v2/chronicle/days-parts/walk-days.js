// Story Director v2, chronicle part: walking receipts to assign each to its story day. Pure.

import { SETTLE } from './digest-constants.js';
import { stepClock } from './clock-step.js';
import { clockSet, receiptOf } from './receipt-classify.js';
import { dayOf } from './shared-text.js';
import { isInt } from './shared-values.js';

/**
 * The receipts (`[{ index, receipt }]` in chat order, as `tools.receipts()` gives them) by story
 * day (only those after revision `after` when given, with the clock at `minutes` before them): `{ days: Map(day → [receipt]), revs: Map(rev → day), settle: { from, to } | null }`.
 * The clock follows the receipts as Story Block replays them (clock-step.js). `settle` is the last time settle's jump (the walked clock
 * at the settle before it, or the settle's own `from` when it is the first, → the walked clock now); `settleAt` is the walked clock at the last settle (`settleAt` in is where the settle before the window left it).
 */
export function walkDays(entries, { after = null, minutes: start = null, settleAt: settled = null } = {}) {
    const list = (Array.isArray(entries) ? entries : []).map(receiptOf).filter(Boolean)
        .filter(receipt => after === null || (isInt(receipt.rev) && receipt.rev > after));
    const days = new Map();
    const revs = new Map();
    let minutes = isInt(start) ? start : null;
    let waiting = [];
    let settle = null;
    let settleAt = isInt(settled) ? settled : null;
    const put = (day, receipt) => {
        if (!days.has(day)) days.set(day, []);
        days.get(day).push(receipt);
        if (isInt(receipt.rev)) revs.set(receipt.rev, day);
    };
    for (const receipt of list) {
        if (clockSet(receipt)) {
            minutes = stepClock(minutes, receipt);
            if (receipt.type === SETTLE) {
                settle = { from: settleAt ?? (isInt(receipt.data.from) ? receipt.data.from : null), to: minutes };
                settleAt = minutes;
            }
        }
        if (minutes === null) {
            waiting.push(receipt);
            continue;
        }
        const day = dayOf(minutes);
        // What came before the clock was first set belongs to its first day.
        if (waiting.length) {
            for (const early of waiting) put(day, early);
            waiting = [];
        }
        put(day, receipt);
    }
    return { days, revs, settle, settleAt, minutes };
}
