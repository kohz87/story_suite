/* NPC State Delta relationship event history: the reply index of an event, history normalization and appending an event. */
import { cleanText } from '../core-text.js';
import { normalizeRelationshipImpact, RELATIONSHIP_EVENT_HISTORY_LIMIT, RELATIONSHIP_KEYS } from '../core-relationship-model.js';
import { normalizeRelationshipEvidence } from './shared-evidence.js';

// Display-only (1.2.3): the chat message index of the reply a relationship change was recorded
// at, shown as "reply #N". `turn` stays Delta's own counter for duplicate/recency checks; events
// recorded before 1.2.3 have no `message`.
export function relationshipEventMessage(raw = {}) {
    const message = Number(raw?.message);
    return Number.isInteger(message) && message >= 0 ? { message } : {};
}

export function normalizeRelationshipEventHistory(value = []) {
    const source = Array.isArray(value) ? value : [];
    const out = [];
    for (const raw of source.slice(-RELATIONSHIP_EVENT_HISTORY_LIMIT * 2)) {
        if (!raw || typeof raw !== 'object') continue;
        const reason = cleanText(raw.reason, 500);
        const evidence = normalizeRelationshipEvidence(raw.evidence);
        if (!reason && !RELATIONSHIP_KEYS.some(key => evidence[key])) continue;
        out.push({
            impact: normalizeRelationshipImpact(raw.impact, true),
            reason,
            evidence,
            sourceMessageId: Number.isInteger(raw.sourceMessageId) ? raw.sourceMessageId : null,
            ...(Number.isFinite(Number(raw.turn)) ? { turn: Number(raw.turn) } : {}),
            ...relationshipEventMessage(raw),
        });
    }
    return out.slice(-RELATIONSHIP_EVENT_HISTORY_LIMIT);
}

export function appendRelationshipEvent(history, event) {
    const normalized = normalizeRelationshipEventHistory([...(Array.isArray(history) ? history : []), event]);
    return normalized.slice(-RELATIONSHIP_EVENT_HISTORY_LIMIT);
}
