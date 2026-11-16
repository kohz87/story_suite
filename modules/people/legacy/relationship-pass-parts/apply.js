// Applying the evaluator's decisions to the dossiers after the merge, and stamping what changed.
import {
    DEFAULT_RELATIONSHIP,
    appendRelationshipEvent,
    applyRelationshipDelta,
    applyRelationshipMilestoneCrossings,
    calibrateRelationshipSummary,
    isTerminalNpcDeath,
    normalizeRelationshipEventHistory,
    normalizeRelationshipEvidence,
    npcMatchesLabel,
    relationshipChangeReasonGrounded,
    relationshipEventMessage,
    relationshipHistoryLooksDuplicate,
    relationshipSummaryConsistent,
    stampChangedFields,
} from '../../core/core.js';
import { applyNpcMemories, scanFactCandidates } from '../../memory/memory-fact-apply.js';
import { spendEvent } from '../relationship-pacing.js';

export function suppressPrimaryRelationshipForFocusedDecisions(parsed, decisions, stateNpcs = () => []) {
    if (!decisions?.size) return parsed;
    const clone = structuredClone(parsed || { npcs: [] });
    for (const raw of clone.npcs || []) {
        const matchedId = [...decisions.keys()].find(id => {
            if (String(raw?.id || '') === String(id)) return true;
            const stateNpc = stateNpcs().find(npc => npc.id === id);
            return Boolean(stateNpc && raw?.name && npcMatchesLabel(stateNpc, raw.name));
        });
        if (!matchedId) continue;
        delete raw.relationship;
        delete raw.relationship_delta;
        if (decisions.get(matchedId)?.relationshipSummaryDecisionProvided) {
            delete raw.relationshipSummary;
            delete raw.relationship_summary;
        }
        raw.relationshipImpact = 'none';
        raw.relationshipDelta = { trust: 0, affection: 0, desire: 0, tension: 0 };
        raw.relationshipEvidence = { trust: '', affection: '', desire: '', tension: '' };
        raw.relationshipChangeReason = '';
    }
    return clone;
}

// Copies the "changed at" stamps for whatever differs between `before` and the record (`npc`) onto it.
export function stampNpcChanges(npc, before, { turn, message = null, storyDay = null } = {}) {
    const stamped = stampChangedFields(before, npc, { turn, message, storyDay });
    for (const key of ['fieldChanges', 'fieldChangeDays', 'fieldChangeMessages', 'memoryStamps']) {
        if (stamped[key] === undefined) delete npc[key];
        else npc[key] = stamped[key];
    }
    return npc;
}

// `pace`: { allowance, day } while Delta works alone (src/relationship-pacing.js: the events each person can have per story day,
// counted on the dossier's own `impactDay`); null while hosted (the slice counts) or with no story day.
export function applyFocusedRelationshipDecisions(state, decisions, caps, sourceMessageId, report = null, pace = null, facts = null) {
    if (!decisions?.size) return state;
    for (const [id, decision] of decisions) {
        const npc = state.npcs.find(item => item.id === id);
        if (!npc || isTerminalNpcDeath(npc)) continue;
        // (cleanup step 9) The pass runs after the merge stamped its changes: it stamps its own.
        const before = structuredClone(npc);
        const requestedHasDelta = Object.values(decision.relationshipDelta || {}).some(value => Number(value) !== 0);
        const evidence = normalizeRelationshipEvidence(decision.relationshipEvidence);
        const duplicateAward = requestedHasDelta && relationshipHistoryLooksDuplicate(npc.relationshipEventHistory, decision.relationshipChangeReason, {
            sourceMessageId,
            turn: state.turn,
            evidence,
        });
        const validReason = !requestedHasDelta || (relationshipChangeReasonGrounded(decision.relationshipChangeReason, '') && !duplicateAward);
        let impact = validReason ? decision.relationshipImpact : 'none';
        if (pace && validReason && requestedHasDelta) {
            const spent = spendEvent(npc.impactDay, { tier: String(impact ?? '').trim().toLowerCase(), reply: Number.isInteger(sourceMessageId) ? sourceMessageId : null, clockDay: pace.day, allowance: pace.allowance });
            if (spent.next) npc.impactDay = spent.next;
            if (spent.skipped.length) impact = spent.used ?? 'none';
        }
        const update = applyRelationshipDelta(
            npc.relationship || DEFAULT_RELATIONSHIP,
            validReason ? decision.relationshipDelta : { trust: 0, affection: 0, desire: 0, tension: 0 },
            impact,
            caps,
            npc.relationshipProgress,
            npc.relationshipMilestones,
        );
        npc.relationship = update.relationship;
        npc.relationshipProgress = update.relationshipProgress;
        npc.relationshipMilestones = applyRelationshipMilestoneCrossings(
            npc.relationshipMilestones,
            update.milestoneCrossings,
            {
                reason: decision.relationshipChangeReason || '',
                sourceMessageId: Number.isInteger(sourceMessageId) ? sourceMessageId : null,
                turn: Number.isFinite(Number(state.turn)) ? Number(state.turn) : null,
            },
        );
        const eventAccepted = Boolean(validReason && update.evidenceAccepted);
        const relationshipActuallyChanged = Object.values(update.appliedDelta || {}).some(value => Number(value) !== 0);
        const relationshipStateAdvanced = relationshipActuallyChanged
            || update.progressChanged
            || update.milestoneCrossings.length > 0;
        const narrativeAdvance = eventAccepted && (
            relationshipStateAdvanced
            || update.milestoneBlocks.length === 0
        );
        let summaryChanged = false;
        const mayInitializeSummary = !String(npc.relationshipSummary || '').trim() && !requestedHasDelta;
        if ((narrativeAdvance || mayInitializeSummary)
            && decision.relationshipSummaryDecisionProvided
            && !(Array.isArray(npc.manualProfileFields) && npc.manualProfileFields.includes('relationshipSummary'))) {
            const proposedSummary = String(decision.relationshipSummary || '').trim().slice(0, 700);
            if (relationshipSummaryConsistent(proposedSummary, npc.relationship, decision.context || '', npc.relationshipMilestones)) {
                const calibrated = calibrateRelationshipSummary(proposedSummary, npc.relationship);
                if (calibrated && calibrated !== String(npc.relationshipSummary || '').trim()) {
                    npc.relationshipSummary = calibrated;
                    summaryChanged = true;
                }
            }
        }
        if (eventAccepted) {
            const event = {
                impact: update.impact,
                delta: update.appliedDelta,
                evidence,
                reason: decision.relationshipChangeReason || '',
                sourceMessageId: Number.isInteger(sourceMessageId) ? sourceMessageId : null,
                turn: Number.isFinite(Number(state.turn)) ? Number(state.turn) : null,
                ...relationshipEventMessage({ message: sourceMessageId }),
            };
            npc.relationshipEventHistory = appendRelationshipEvent(npc.relationshipEventHistory, event);
            if (relationshipStateAdvanced) npc.lastRelationshipChange = event;
        } else {
            npc.relationshipEventHistory = normalizeRelationshipEventHistory(npc.relationshipEventHistory);
        }
        // (memory facts) This pass applies most real movements, after the merge: the applied delta of an accepted event is a fact candidate (null without the rule/mark).
        const factMove = facts && eventAccepted ? scanFactCandidates(npc, update, { facts, R: sourceMessageId, player: facts.player }) : [];
        if (factMove.length) applyNpcMemories(npc, npc, {}, { candidates: factMove, locked: (npc.manualProfileFields || []).includes('memories') });
        if (eventAccepted || update.progressChanged || summaryChanged) {
            npc.updatedAt = Date.now();
            if (report?.updated && !report.updated.includes(id)) report.updated.push(id);
        }
        stampNpcChanges(npc, before, { turn: state.turn, message: Number.isInteger(sourceMessageId) ? sourceMessageId : null });
    }
    return state;
}
