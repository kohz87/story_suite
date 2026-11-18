// Which existing NPCs the current exchange makes a target of the focused relationship pass.
import {
    normalizeName,
    normalizeRelationshipEvidence,
    npcMatchesLabel,
    relationshipAxisEvidenceGrounded,
} from '../../core/core.js';

export function transcriptMentionsNpcRecord(transcript, npc) {
    const haystack = ` ${normalizeName(transcript)} `;
    if (!haystack.trim() || !npc) return false;
    const labels = [npc.name, ...(npc.aliases || [])]
        .map(normalizeName)
        .filter(label => label.length >= 2);
    return labels.some(label => haystack.includes(` ${label} `));
}

export function currentExchangeRelationshipRelevant(npc, transcript, raw = null, { currentExchangeOnly = false } = {}) {
    if (!npc || npc.archived) return false;
    // Full-window reconciliation must never turn historical presence or a previous live flag
    // into a fresh relationship event. Only an explicit name/alias participation cue in the
    // current exchange can make an omitted existing dossier a relationship target. Quick scans
    // already operate on the current exchange, so their returned row remains sufficient.
    if (transcriptMentionsNpcRecord(transcript, npc)) return true;
    if (currentExchangeOnly) return false;
    return Boolean(raw);
}

export function rawScanMatchesExisting(raw, npc) {
    if (!raw || !npc) return false;
    if (raw.id && String(raw.id) === String(npc.id)) return true;
    if (raw.name && npcMatchesLabel(npc, raw.name)) return true;
    return Array.isArray(raw.aliases) && raw.aliases.some(alias => npcMatchesLabel(npc, alias));
}

export function hasCompletePrimaryRelationshipDecision(raw, transcript = '') {
    if (!raw || typeof raw !== 'object') return false;
    const delta = raw.relationshipDelta ?? raw.relationship_delta;
    const hasFullDelta = delta && typeof delta === 'object'
        && ['trust', 'affection', 'desire', 'tension'].every(key => Number.isFinite(Number(delta[key])));
    if (!hasFullDelta) return false;
    const rawImpact = String(raw.relationshipImpact ?? raw.impactLevel ?? raw.relationshipImpactLevel ?? '').trim().toLowerCase();
    if (!['none', 'ordinary', 'meaningful', 'major', 'extreme'].includes(rawImpact)) return false;
    const hasNonZero = ['trust', 'affection', 'desire', 'tension'].some(key => Number(delta[key]) !== 0);
    if (hasNonZero && rawImpact === 'none') return false;
    if (!hasNonZero && rawImpact !== 'none') return false;
    if (hasNonZero) {
        const reason = String(raw.relationshipChangeReason ?? raw.relationship_change_reason ?? raw.relationshipReason ?? '').trim();
        if (!reason) return false;
        const evidenceSource = raw.relationshipEvidence ?? raw.relationship_evidence;
        if (!evidenceSource || typeof evidenceSource !== 'object') return false;
        const evidence = normalizeRelationshipEvidence(evidenceSource);
        for (const key of ['trust', 'affection', 'desire', 'tension']) {
            if (Number(delta[key]) !== 0 && !relationshipAxisEvidenceGrounded(key, evidence[key], transcript)) return false;
        }
    }
    if (hasNonZero && ['major', 'extreme'].includes(rawImpact)) {
        const summary = raw.relationshipSummary ?? raw.relationship_summary;
        if (typeof summary !== 'string' || !summary.trim()) return false;
    }
    return true;
}
