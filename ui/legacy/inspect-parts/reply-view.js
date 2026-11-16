// One reply as the inspector shows it: its state, the state before, the diff, its ops, receipts and problems.

import { readRecord } from '../../../../../core/persist.js';
import { oneLine } from '../../../../../core/text.js';
import { receiptCue } from '../lean-rpg/cue.js';
import { diffStates } from './diff.js';

export const receiptView = receipt => ({
    id: String(receipt?.id ?? ''),
    type: String(receipt?.type ?? ''),
    module: String(receipt?.module ?? ''),
    cause: String(receipt?.cause ?? ''),
    rev: Number.isInteger(receipt?.rev) ? receipt.rev : null,
    summary: oneLine(receiptCue(receipt), 300),
    narrate: receipt?.narrate !== false,
});

/**
 * One reply as the inspector shows it, or `{ ok: false, index, message }` when it holds no story:
 * `{ ok: true, index, name, rev, checkpoint, head, state, before, diff: { entries, more }, ops, receipts,
 * problems: [{ code, message }] }`. `problems(index)` → the problems the host knows of for that reply
 * (replay, the turn's, the refused change lines). `state` and `before` are the store's frozen copies.
 */
export function inspectReply({ store, chat, index, problems = () => [] }) {
    const messages = Array.isArray(chat) ? chat : [];
    const record = Number.isInteger(index) ? readRecord(messages[index]) : null;
    if (!record) return { ok: false, index, message: 'That message holds no story record (a reader\'s message, or a reply from before the story).' };
    let state;
    let before;
    try {
        state = store.at(index);
        before = store.before?.(index) ?? null;
    } catch (error) {
        return { ok: false, index, message: `The state at that reply could not be worked out: ${error?.message ?? error}` };
    }
    const head = store.headIndex?.();
    const receipts = (Array.isArray(record.receipts) ? record.receipts : []).map(receiptView);
    let found = [];
    try { found = problems(index) ?? []; } catch { found = []; }
    return {
        ok: true,
        index,
        name: oneLine(messages[index]?.name ?? '', 40),
        rev: state?.meta?.rev ?? null,
        checkpoint: Boolean(record.checkpoint),
        head: index === head,
        state,
        before,
        diff: diffStates(before, state),
        ops: store.opsAt?.(index) ?? [],
        receipts,
        problems: found.map(item => ({ code: String(item?.code ?? item?.why ?? ''), message: oneLine(item?.message ?? item?.reason ?? item?.line ?? item, 400) })),
    };
}
