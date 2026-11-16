// Story Director v2, chronicle part: walking receipts to assign each to its story day. Pure.

import { SETTLE } from './digest-constants.js';
import { clockSet, receiptOf } from './receipt-classify.js';
import { dayOf } from './shared-text.js';
import { isInt } from './shared-values.js';

/**
 * The receipts (`[{ index, receipt }]` in chat order, as `tools.receipts()` gives them) by story
 * day (only those after revision `after` when given, with the clock at `minutes` before them): `{ days: Map(day → [receipt]), revs: Map(rev → day), settle: { from, to } | null }`.
 * `settle` is the last time settle's jump (the time part's receipt: the clock before and after it).
 */
export function walkDays(entries, { after = null, minutes: start = null } = {}) {
    // Each receipt with its chat index (bare receipts have none).
    const list = (Array.isArray(entries) ? entries : []).map(entry => ({ receipt: receiptOf(entry), index: entry?.index })).filter(item => item.receipt)
        .filter(({ receipt }) => after === null || (isInt(receipt.rev) && receipt.rev > after));
    const days = new Map();
    const revs = new Map();
    let minutes = isInt(start) ? start : null;
    let waiting = [];
    let settle = null;
    let setBy = null;
    const put = (day, receipt) => {
        if (!days.has(day)) days.set(day, []);
        days.get(day).push(receipt);
        if (isInt(receipt.rev)) revs.set(receipt.rev, day);
    };
    for (const { receipt, index } of list) {
        // A settle a Re-read kept keeps its pre-edit clock and sorts after the edit's new clock line in the same reply: that line wins.
        const stale = receipt.type === SETTLE && setBy !== null && index !== undefined && setBy.index === index && setBy.type !== SETTLE && setBy.minutes !== receipt.data?.minutes;
        if (clockSet(receipt)) {
            if (!stale) {
                minutes = receipt.data.minutes;
                setBy = { index, type: receipt.type, minutes };
            }
            if (receipt.type === SETTLE) settle = { from: isInt(receipt.data.from) ? receipt.data.from : null, to: minutes };
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
    return { days, revs, settle, minutes };
}
