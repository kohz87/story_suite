// Rollback journal retention: pruning a journal to its window and refreshing a state's retention figures.
import { ROLLBACK_JOURNAL_BUDGET_BYTES, ROLLBACK_JOURNAL_LIMIT, ROLLBACK_JOURNAL_WINDOW_MESSAGES } from '../branch-constants.js';
import { normalizeRollbackJournal, rollbackEntryBytes } from './entries.js';

export function pruneRollbackJournal(
    entries = [],
    headSeq = 0,
    limit = ROLLBACK_JOURNAL_LIMIT,
    headMessageId = null,
    floorMessageId = null,
    checkpointSeqs = [],
) {
    const cap = Math.max(64, Number(limit) || ROLLBACK_JOURNAL_LIMIT);
    const normalized = normalizeRollbackJournal(entries);
    if (!normalized.length) return [];
    const bySeq = new Map(normalized.map(entry => [entry.seq, entry]));
    const active = [];
    const activeSeqs = new Set();
    let cursor = Number(headSeq) || 0;
    // The active chain is authoritative. Never shorten the advertised raw-message rollback
    // window merely because its serialized bytes exceed a target; only stale/sibling extras
    // are byte-budgeted. A cycle or missing predecessor still terminates safely.
    while (cursor > 0) {
        const entry = bySeq.get(cursor);
        if (!entry || activeSeqs.has(entry.seq)) break;
        active.push(entry);
        activeSeqs.add(entry.seq);
        cursor = entry.prevSeq;
    }

    const resolvedHeadMessageId = Number.isInteger(headMessageId)
        ? headMessageId
        : (active[0]?.messageId ?? -1);
    const resolvedFloorMessageId = Number.isInteger(floorMessageId)
        ? floorMessageId
        : (resolvedHeadMessageId >= 0 ? resolvedHeadMessageId - ROLLBACK_JOURNAL_WINDOW_MESSAGES : -1);
    const keep = active.filter(entry => entry.messageId >= resolvedFloorMessageId);
    const keptSeqs = new Set(keep.map(entry => entry.seq));
    // Retained full checkpoints own their undo predecessors too. Their required history is
    // diagnostic-budgeted like the active chain; optional extras must not strand a revisit.
    for (const seq of checkpointSeqs) {
        let entry = bySeq.get(seq);
        while (entry && !keptSeqs.has(entry.seq) && entry.messageId >= resolvedFloorMessageId) {
            keep.push(entry);
            keptSeqs.add(entry.seq);
            entry = bySeq.get(entry.prevSeq);
        }
    }
    let used = keep.reduce((sum, entry) => sum + rollbackEntryBytes(entry), 0);

    // Recent sibling entries are opportunistic. They may improve branch revisits but can never
    // displace the contiguous active chain needed for the guaranteed chronological window.
    const remaining = normalized
        .filter(entry => !activeSeqs.has(entry.seq) && !keptSeqs.has(entry.seq))
        .filter(entry => entry.messageId >= resolvedFloorMessageId)
        .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq);
    for (const entry of remaining) {
        if (keep.length >= cap) break;
        const chain = [];
        const seen = new Set();
        let candidate = entry;
        while (candidate && !keptSeqs.has(candidate.seq) && !seen.has(candidate.seq)
            && candidate.messageId >= resolvedFloorMessageId) {
            chain.push(candidate);
            seen.add(candidate.seq);
            candidate = bySeq.get(candidate.prevSeq);
        }
        const size = chain.reduce((sum, item) => sum + rollbackEntryBytes(item), 0);
        if (keep.length + chain.length > cap || used + size > ROLLBACK_JOURNAL_BUDGET_BYTES) continue;
        keep.push(...chain);
        for (const item of chain) keptSeqs.add(item.seq);
        used += size;
    }
    return keep.sort((a, b) => a.seq - b.seq);
}

export function refreshRollbackJournalRetention(state) {
    if (!state || typeof state !== 'object') return state;
    const headMessageId = Number.isInteger(state.rollbackHead?.messageId) ? state.rollbackHead.messageId : -1;
    const baselineFloor = Number.isInteger(state.rollbackJournalFloorMessageId)
        ? state.rollbackJournalFloorMessageId
        : headMessageId;
    const rollingFloor = headMessageId >= 0 ? headMessageId - ROLLBACK_JOURNAL_WINDOW_MESSAGES : -1;
    const floorMessageId = Math.max(baselineFloor, rollingFloor);
    state.rollbackJournalFloorMessageId = floorMessageId;
    state.rollbackJournal = pruneRollbackJournal(
        state.rollbackJournal,
        state.rollbackHead?.seq,
        ROLLBACK_JOURNAL_LIMIT,
        headMessageId,
        floorMessageId,
        (state.checkpoints || []).map(checkpoint => checkpoint.rollbackSeq),
    );
    // If the last actual mutation aged out while the head advanced only across unchanged raw
    // messages, its sequence pointer must not dangle. The current head snapshot is a valid
    // baseline for the retained window because no canonical mutation occurred after that entry.
    if (Number(state.rollbackHead?.seq || 0) > 0
        && !state.rollbackJournal.some(entry => entry.seq === state.rollbackHead.seq)) {
        state.rollbackHead.seq = 0;
    }
    const bytes = state.rollbackJournal.reduce((sum, entry) => sum + rollbackEntryBytes(entry), 0);
    state.rollbackJournalBytes = bytes;
    state.rollbackJournalBudgetExceeded = bytes > ROLLBACK_JOURNAL_BUDGET_BYTES;
    state.rollbackJournalCoverageMessages = headMessageId >= floorMessageId
        ? Math.max(0, headMessageId - floorMessageId)
        : 0;
    return state;
}
