// Reads the rolls kept on one reply out of the receipts: the result record's version and `rollsOf`.
import { isRollReceipt } from './board/results.js';

/** The version of a fight result record (`v` in `data.v2.result`). */
export const RESULT_VERSION = 1;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * The rolls kept on one reply: `entries` = [{ index, receipt }] (store.receipts(), or the receipts of one record with an
 * `index`), `index` = the reply. → { receipt, result, summary } for the last fight receipt there that has a
 * result record, else null.
 */
export function rollsOf(entries, index) {
    const found = (Array.isArray(entries) ? entries : []).findLast(entry => isRollReceipt(entry?.receipt) && entry.index === index
        && isObject(entry.receipt.data?.v2?.result) && entry.receipt.data.v2.result.v === RESULT_VERSION);
    if (!found) return null;
    const result = found.receipt.data.v2.result;
    return { receipt: found.receipt, result, summary: result.summary ?? { exchanges: result.rounds?.length ?? 0, acts: [], refused: 0 } };
}
