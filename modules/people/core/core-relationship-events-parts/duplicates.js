/* NPC State Delta relationship duplicates: detects a relationship change or history that repeats a recent event. */
import { cleanText, normalizeName } from '../core-text.js';
import { RELATIONSHIP_KEYS } from '../core-relationship-model.js';
import { durableSemanticSimilarity } from '../core-relationship-text.js';
import { normalizeRelationshipEvidence } from './shared-evidence.js';
import { normalizeRelationshipEventHistory } from './history.js';

function relationshipReasonSimilarity(a, b) {
    const left = cleanText(a, 500);
    const right = cleanText(b, 500);
    if (!left || !right) return 0;
    if (normalizeName(left) === normalizeName(right)) return 1;
    return durableSemanticSimilarity(left, right);
}

function relationshipEventText(event) {
    const evidence = normalizeRelationshipEvidence(event?.evidence);
    return [cleanText(event?.reason, 500), ...RELATIONSHIP_KEYS.map(key => evidence[key])].filter(Boolean).join(' ');
}

export function relationshipChangeLooksDuplicate(previousChange, reason, { sourceMessageId = null, turn = null, evidence = null } = {}) {
    const previous = previousChange && typeof previousChange === 'object' ? previousChange : {};
    if (String(previous.impact || '').toLowerCase() === 'manual') return false;
    const currentText = [cleanText(reason, 500), ...RELATIONSHIP_KEYS.map(key => cleanText(evidence?.[key], 300))].filter(Boolean).join(' ');
    const priorText = relationshipEventText(previous) || cleanText(previous.reason, 500);
    if (!currentText || !priorText) return false;
    const priorTurn = Number(previous.turn);
    const currentTurn = Number(turn);
    const recentByTurn = Number.isFinite(priorTurn) && Number.isFinite(currentTurn) && Math.abs(currentTurn - priorTurn) <= 8;
    const recentByMessage = Number.isInteger(sourceMessageId) && Number.isInteger(previous.sourceMessageId)
        && Math.abs(sourceMessageId - previous.sourceMessageId) <= 10;
    if (!recentByTurn && !recentByMessage) return false;
    return relationshipReasonSimilarity(priorText, currentText) >= 0.68;
}

export function relationshipHistoryLooksDuplicate(history, reason, options = {}) {
    return normalizeRelationshipEventHistory(history).some(event => relationshipChangeLooksDuplicate(event, reason, options));
}
