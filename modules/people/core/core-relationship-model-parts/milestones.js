/* Relationship milestone normalizing, unlock test, manual inference and crossing application. */
import { cleanText } from '../core-text.js';
import { DEFAULT_RELATIONSHIP, RELATIONSHIP_KEYS } from './profile-defaults.js';
import { RELATIONSHIP_MILESTONE_LIMIT, RELATIONSHIP_MILESTONE_THRESHOLDS } from './milestone-constants.js';
import { normalizeRelationshipBaseline } from './baseline-caps.js';

function normalizeMilestonePolarity(value) {
    const number = Number(value);
    if (number > 0) return 1;
    if (number < 0) return -1;
    const text = String(value ?? '').trim().toLowerCase();
    if (['positive', 'pos', '+', 'plus'].includes(text)) return 1;
    if (['negative', 'neg', '-', 'minus'].includes(text)) return -1;
    return 0;
}

function milestoneIdentity(entry) {
    return `${entry.axis}:${entry.polarity}:${entry.threshold}`;
}

function inferredMilestoneEntries(relationship = DEFAULT_RELATIONSHIP, { includeBoundary = false, reason = 'Existing relationship depth predates milestone tracking.' } = {}) {
    const rel = normalizeRelationshipBaseline(relationship || DEFAULT_RELATIONSHIP);
    const out = [];
    for (const axis of RELATIONSHIP_KEYS) {
        const score = rel[axis];
        const polarity = Math.sign(score);
        if (!polarity) continue;
        const magnitude = Math.abs(score);
        for (const threshold of RELATIONSHIP_MILESTONE_THRESHOLDS) {
            const established = includeBoundary ? magnitude >= threshold : magnitude > threshold;
            if (!established) continue;
            out.push({
                axis,
                polarity,
                threshold,
                reason,
                sourceMessageId: null,
                turn: null,
                inferred: true,
            });
        }
    }
    return out;
}

export function normalizeRelationshipMilestones(value, relationship = DEFAULT_RELATIONSHIP, { inferFromRelationship = true } = {}) {
    const source = Array.isArray(value) ? value : [];
    const map = new Map();
    for (const raw of source) {
        if (!raw || typeof raw !== 'object') continue;
        const axis = RELATIONSHIP_KEYS.includes(String(raw.axis || '').trim().toLowerCase()) ? String(raw.axis).trim().toLowerCase() : '';
        const polarity = normalizeMilestonePolarity(raw.polarity);
        const threshold = Number(raw.threshold);
        if (!axis || !polarity || !RELATIONSHIP_MILESTONE_THRESHOLDS.includes(threshold)) continue;
        const entry = {
            axis,
            polarity,
            threshold,
            reason: cleanText(raw.reason, 300) || 'Relationship depth established.',
            sourceMessageId: Number.isInteger(raw.sourceMessageId) ? raw.sourceMessageId : null,
            turn: Number.isFinite(Number(raw.turn)) ? Number(raw.turn) : null,
            inferred: Boolean(raw.inferred),
        };
        map.set(milestoneIdentity(entry), entry);
    }
    if (inferFromRelationship) {
        for (const entry of inferredMilestoneEntries(relationship)) {
            const key = milestoneIdentity(entry);
            if (!map.has(key)) map.set(key, entry);
        }
    }
    return [...map.values()]
        .sort((a, b) => RELATIONSHIP_KEYS.indexOf(a.axis) - RELATIONSHIP_KEYS.indexOf(b.axis)
            || a.polarity - b.polarity
            || a.threshold - b.threshold)
        .slice(0, RELATIONSHIP_MILESTONE_LIMIT);
}

export function relationshipMilestoneUnlocked(milestones, axis, polarity, threshold) {
    const normalized = normalizeRelationshipMilestones(milestones, DEFAULT_RELATIONSHIP, { inferFromRelationship: false });
    const key = String(axis || '').trim().toLowerCase();
    const sign = normalizeMilestonePolarity(polarity);
    const point = Number(threshold);
    return normalized.some(entry => entry.axis === key && entry.polarity === sign && entry.threshold === point);
}

export function inferManualRelationshipMilestones(milestones, relationship, reason = 'Manual dossier adjustment established this relationship depth.', sourceMessageId = null, turn = null) {
    const map = new Map(normalizeRelationshipMilestones(milestones, relationship).map(entry => [milestoneIdentity(entry), entry]));
    for (const entry of inferredMilestoneEntries(relationship, { includeBoundary: true, reason })) {
        entry.inferred = false;
        entry.sourceMessageId = Number.isInteger(sourceMessageId) ? sourceMessageId : null;
        entry.turn = Number.isFinite(Number(turn)) ? Number(turn) : null;
        map.set(milestoneIdentity(entry), entry);
    }
    return normalizeRelationshipMilestones([...map.values()], relationship, { inferFromRelationship: false });
}

export function applyRelationshipMilestoneCrossings(milestones, crossings = [], { reason = '', sourceMessageId = null, turn = null } = {}) {
    const map = new Map(normalizeRelationshipMilestones(milestones, DEFAULT_RELATIONSHIP, { inferFromRelationship: false }).map(entry => [milestoneIdentity(entry), entry]));
    for (const raw of Array.isArray(crossings) ? crossings : []) {
        const axis = RELATIONSHIP_KEYS.includes(String(raw?.axis || '').trim().toLowerCase()) ? String(raw.axis).trim().toLowerCase() : '';
        const polarity = normalizeMilestonePolarity(raw?.polarity);
        const threshold = Number(raw?.threshold);
        if (!axis || !polarity || !RELATIONSHIP_MILESTONE_THRESHOLDS.includes(threshold)) continue;
        const entry = {
            axis,
            polarity,
            threshold,
            reason: cleanText(reason || raw.reason, 300) || `Relationship crossed the ${polarity > 0 ? '+' : '-'}${threshold} ${axis} milestone.`,
            sourceMessageId: Number.isInteger(sourceMessageId) ? sourceMessageId : null,
            turn: Number.isFinite(Number(turn)) ? Number(turn) : null,
            inferred: false,
        };
        map.set(milestoneIdentity(entry), entry);
    }
    return normalizeRelationshipMilestones([...map.values()], DEFAULT_RELATIONSHIP, { inferFromRelationship: false });
}
