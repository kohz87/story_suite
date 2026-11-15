// Recording rollback mutations: appending (or coalescing) a mutation and settling the head on a turn.
import { lineageCheckpointKeys } from '../branch-lineage.js';
import { applyRollbackUndo, buildRollbackUndo, rollbackSnapshot } from '../branch-rollback-undo.js';
import { ensureRollbackJournalBaseline } from './baseline.js';
import { refreshRollbackJournalRetention } from './retention.js';

export function appendRollbackMutation(state, lineage, messageId, reason, afterSnapshot) {
    ensureRollbackJournalBaseline(state, Array.isArray(state.lineage) ? state.lineage : lineage);
    const head = state.rollbackHead;
    const keys = lineageCheckpointKeys(lineage);

    // Multiple deterministic writers can checkpoint the same raw SillyTavern message (for
    // example scan then backfill). Coalesce them into one message-owned undo record by rebuilding
    // the delta from the earliest before-state to the latest accepted after-state.
    if (head?.seq > 0 && head.messageId === messageId && head.lineageKey === (keys[messageId] || '')) {
        const index = state.rollbackJournal.findIndex(entry => entry.seq === head.seq);
        const existing = index >= 0 ? state.rollbackJournal[index] : null;
        if (existing && existing.messageId === messageId && existing.lineageKey === head.lineageKey) {
            const earliest = applyRollbackUndo(head.snapshot, existing.undo).state;
            const combinedUndo = buildRollbackUndo(rollbackSnapshot(earliest), afterSnapshot);
            // The checkpoint at this exact lineage will be replaced below. Any other
            // checkpoint or descendant still owns the old version, including net-zero revisits.
            const referenced = state.rollbackJournal.some(entry => entry.prevSeq === existing.seq)
                || (state.checkpoints || []).some(checkpoint => checkpoint.rollbackSeq === existing.seq
                    && checkpoint.lineageKey !== head.lineageKey);
            let seq = existing.prevSeq;
            if (combinedUndo) {
                seq = referenced ? state.rollbackJournalSequence + 1 : existing.seq;
                const combined = {
                    ...existing, seq,
                    fingerprint: lineage[messageId] || existing.fingerprint || '',
                    lineageKey: keys[messageId] || existing.lineageKey || '',
                    parentLineageKey: messageId > 0 ? keys[messageId - 1] : 'root',
                    reason: String(reason || existing.reason || 'state'),
                    createdAt: Date.now(),
                    undo: combinedUndo,
                };
                if (referenced) state.rollbackJournal.push(combined);
                else state.rollbackJournal[index] = combined;
                state.rollbackJournalSequence = Math.max(state.rollbackJournalSequence, seq);
            } else if (!referenced) {
                state.rollbackJournal.splice(index, 1);
            }
            state.rollbackHead = {
                seq, messageId, lineageKey: keys[messageId] || '',
                snapshot: structuredClone(afterSnapshot),
            };
            refreshRollbackJournalRetention(state);
            return seq;
        }
    }

    const beforeSnapshot = head?.snapshot && typeof head.snapshot === 'object' ? head.snapshot : rollbackSnapshot(state);
    const undo = buildRollbackUndo(beforeSnapshot, afterSnapshot);
    if (undo) {
        const seq = Math.max(Number(state.rollbackJournalSequence || 0), ...state.rollbackJournal.map(entry => entry.seq), 0) + 1;
        const entry = {
            seq,
            prevSeq: Math.max(0, Number(head?.seq || 0)),
            messageId,
            beforeMessageId: Number.isInteger(head?.messageId) ? head.messageId : Math.max(-1, messageId - 1),
            fingerprint: lineage[messageId] || '',
            lineageKey: keys[messageId] || '',
            parentLineageKey: messageId > 0 ? keys[messageId - 1] : 'root',
            reason: String(reason || 'state'),
            createdAt: Date.now(),
            undo,
        };
        state.rollbackJournal.push(entry);
        state.rollbackJournalSequence = seq;
        state.rollbackHead = {
            seq,
            messageId,
            lineageKey: entry.lineageKey,
            snapshot: structuredClone(afterSnapshot),
        };
    } else {
        state.rollbackHead = {
            seq: Math.max(0, Number(head?.seq || 0)),
            messageId,
            lineageKey: keys[messageId] || String(head?.lineageKey || ''),
            snapshot: structuredClone(afterSnapshot),
        };
    }
    refreshRollbackJournalRetention(state);
    return state.rollbackHead.seq;
}

export function settleRollbackHead(state, lineage = [], reason = 'turn-settled') {
    if (!state || typeof state !== 'object' || !Array.isArray(lineage) || !lineage.length) return state;
    ensureRollbackJournalBaseline(state, lineage);
    const tailId = lineage.length - 1;
    const keys = lineageCheckpointKeys(lineage);
    const head = state.rollbackHead;
    if (Number.isInteger(head?.messageId) && head.messageId >= 0 && head.messageId < lineage.length
        && head.lineageKey && head.lineageKey !== keys[head.messageId]) return state;
    const currentSnapshot = rollbackSnapshot(state);
    if (buildRollbackUndo(head?.snapshot || {}, currentSnapshot)) {
        appendRollbackMutation(state, lineage, tailId, reason, currentSnapshot);
    } else if (head && (head.messageId !== tailId || head.lineageKey !== keys[tailId])) {
        state.rollbackHead = {
            seq: Math.max(0, Number(head.seq || 0)),
            messageId: tailId,
            lineageKey: keys[tailId] || 'root',
            snapshot: structuredClone(currentSnapshot),
        };
        refreshRollbackJournalRetention(state);
    }
    return state;
}
