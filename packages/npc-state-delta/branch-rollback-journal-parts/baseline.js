// Making sure a state has a trustworthy rollback journal baseline and head.
import { ROLLBACK_JOURNAL_VERSION } from '../branch-constants.js';
import { lineageCheckpointKeys } from '../branch-lineage.js';
import { rollbackSnapshot } from '../branch-rollback-undo.js';
import { normalizeRollbackJournal } from './entries.js';
import { refreshRollbackJournalRetention } from './retention.js';

export function ensureRollbackJournalBaseline(state, lineage = []) {
    if (!state || typeof state !== 'object') return state;
    const sourceLineage = Array.isArray(lineage) ? lineage : [];
    const keys = lineageCheckpointKeys(sourceLineage);
    state.rollbackJournalVersion = ROLLBACK_JOURNAL_VERSION;
    state.rollbackJournal = normalizeRollbackJournal(state.rollbackJournal);
    state.rollbackJournalSequence = Math.max(
        Number.isInteger(state.rollbackJournalSequence) ? state.rollbackJournalSequence : 0,
        ...state.rollbackJournal.map(entry => entry.seq),
        0,
    );

    const head = state.rollbackHead;
    if (!head || typeof head !== 'object' || !head.snapshot || typeof head.snapshot !== 'object') {
        const messageId = sourceLineage.length - 1;
        state.rollbackHead = {
            seq: 0,
            messageId,
            lineageKey: messageId >= 0 ? keys[messageId] : 'root',
            snapshot: rollbackSnapshot(state),
        };
        // This is the trustworthy baseline. Older history cannot be invented during an upgrade.
        state.rollbackJournalFloorMessageId = messageId;
        state.rollbackJournal = [];
        return refreshRollbackJournalRetention(state);
    }

    state.rollbackHead = {
        seq: Math.max(0, Number.isInteger(head.seq) ? head.seq : 0),
        messageId: Number.isInteger(head.messageId) ? head.messageId : sourceLineage.length - 1,
        lineageKey: String(head.lineageKey || ''),
        snapshot: structuredClone(head.snapshot),
    };
    state.rollbackJournalFloorMessageId = Number.isInteger(state.rollbackJournalFloorMessageId)
        ? state.rollbackJournalFloorMessageId
        : state.rollbackHead.messageId;
    return refreshRollbackJournalRetention(state);
}
