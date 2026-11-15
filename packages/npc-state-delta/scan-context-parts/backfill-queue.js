/* NPC State Delta: the automatic backfill queue request shape and its reasons. */
import { text } from './shared-text.js';

export const AUTOMATIC_BACKFILL_QUEUE_VERSION = 1;
export const AUTOMATIC_MISSED_PARTICIPANT_REPAIR_LIMIT = 1;
export const AUTOMATIC_BACKFILL_REASONS = Object.freeze(['missed-participant', 'new-admission']);

export function normalizeAutomaticBackfillRequest(raw = {}) {
    if (!raw || typeof raw !== 'object') return null;
    if (Number(raw.queueVersion) !== AUTOMATIC_BACKFILL_QUEUE_VERSION) return null;
    const reason = text(raw.reason);
    if (!AUTOMATIC_BACKFILL_REASONS.includes(reason)) return null;
    const npcId = text(raw.npcId).slice(0, 100);
    const label = text(raw.label).slice(0, 120);
    if (!npcId || !label) return null;
    return {
        queueVersion: AUTOMATIC_BACKFILL_QUEUE_VERSION,
        reason,
        npcId,
        label,
        requestedMessageId: Number.isInteger(raw.requestedMessageId) ? raw.requestedMessageId : null,
        preserveLiveState: raw.preserveLiveState === true,
        silent: raw.silent === true,
        requestedAt: Math.max(0, Number(raw.requestedAt || 0) || 0),
        attempts: Math.max(0, Math.round(Number(raw.attempts) || 0)),
        lastAttemptAt: Math.max(0, Number(raw.lastAttemptAt || 0) || 0),
    };
}
