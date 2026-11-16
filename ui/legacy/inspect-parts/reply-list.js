// The list of replies that keep the story, newest first, for the inspector's picker.

import { carrierIndexes, readRecord } from '../../../core/persist.js';
import { cutAt, oneLine } from '../../../core/text.js';
import { LIMITS } from './shared.js';

/**
 * The replies that keep the story (carriers with a record for their shown swipe), newest first:
 * [{ index, name, snippet, rev, receipts, ops, checkpoint, head }]. `head`: the head carrier's index.
 */
export function replyList(chat, { head = null } = {}) {
    const messages = Array.isArray(chat) ? chat : [];
    const out = [];
    for (const index of carrierIndexes(messages)) {
        const record = readRecord(messages[index]);
        if (!record) continue;
        const receipts = Array.isArray(record.receipts) ? record.receipts : [];
        const lastRev = receipts.reduce((best, receipt) => (Number.isInteger(receipt?.rev) && receipt.rev > best ? receipt.rev : best), 0);
        out.push({
            index,
            name: oneLine(messages[index]?.name ?? '', 40),
            // Cut before comments (the hidden change block) and tags are taken out, so a long reply full
            // of `<` costs no more than its start.
            snippet: oneLine(cutAt(String(messages[index]?.mes ?? ''), LIMITS.snippet * 10).replace(/<!--[\s\S]*?(?:-->|$)/g, ' ').replace(/<[^<>]*>/g, ' '), LIMITS.snippet),
            rev: Number.isInteger(record.rev) ? record.rev : lastRev,
            receipts: receipts.length,
            ops: Array.isArray(record.ops) ? record.ops.length : 0,
            checkpoint: Boolean(record.checkpoint),
            head: index === head,
        });
    }
    return out.reverse();
}
