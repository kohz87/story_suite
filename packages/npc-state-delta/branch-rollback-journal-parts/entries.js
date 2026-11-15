// Rollback journal entries: normalizing a journal and measuring an entry's stored size.
import { utf8Bytes } from '../branch-util.js';

function normalizeRollbackJournalEntry(raw) {
    if (!raw || typeof raw !== 'object' || !raw.undo || typeof raw.undo !== 'object') return null;
    const seq = Number(raw.seq);
    const prevSeq = Number(raw.prevSeq);
    const messageId = Number(raw.messageId);
    const beforeMessageId = Number(raw.beforeMessageId);
    if (!Number.isInteger(seq) || seq <= 0 || !Number.isInteger(prevSeq) || prevSeq < 0) return null;
    if (!Number.isInteger(messageId) || messageId < 0) return null;
    return {
        ...raw,
        seq,
        prevSeq,
        messageId,
        beforeMessageId: Number.isInteger(beforeMessageId) ? beforeMessageId : Math.max(-1, messageId - 1),
        lineageKey: String(raw.lineageKey || ''),
        parentLineageKey: String(raw.parentLineageKey || ''),
        reason: String(raw.reason || 'state'),
        createdAt: Number(raw.createdAt || 0) || Date.now(),
    };
}

export function normalizeRollbackJournal(entries = []) {
    const bySeq = new Map();
    for (const raw of Array.isArray(entries) ? entries : []) {
        const entry = normalizeRollbackJournalEntry(raw);
        if (!entry) continue;
        const existing = bySeq.get(entry.seq);
        if (!existing || entry.createdAt >= existing.createdAt) bySeq.set(entry.seq, entry);
    }
    return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function rollbackEntryBytes(entry) {
    return utf8Bytes(entry) + 96;
}
