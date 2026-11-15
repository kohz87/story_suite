/* Prepares a full-window scan answer for relationship evaluation and merge by stripping its rolling relationship fields. */
function stripRollingRelationshipFields(raw, { explicitZero = false } = {}) {
    if (!raw || typeof raw !== 'object') return raw;
    delete raw.relationship;
    delete raw.relationship_delta;
    delete raw.relationshipDelta;
    delete raw.relationshipImpact;
    delete raw.relationship_impact;
    delete raw.relationshipChangeReason;
    delete raw.relationship_change_reason;
    delete raw.relationshipEvidence;
    delete raw.relationship_evidence;
    if (explicitZero) {
        raw.relationshipImpact = 'none';
        raw.relationshipDelta = { trust: 0, affection: 0, desire: 0, tension: 0 };
        raw.relationshipEvidence = { trust: '', affection: '', desire: '', tension: '' };
        raw.relationshipChangeReason = '';
    }
    return raw;
}

export function prepareFullWindowRelationshipPayload(parsed, existingNpcs = []) {
    void existingNpcs; // retained API parameter for compatibility; every rolling row is scrubbed.
    const evaluation = structuredClone(parsed || { npcs: [] });
    const mergeSafe = structuredClone(parsed || { npcs: [] });
    const count = Math.max(evaluation.npcs?.length || 0, mergeSafe.npcs?.length || 0);
    for (let i = 0; i < count; i += 1) {
        const evalRaw = evaluation.npcs?.[i];
        const safeRaw = mergeSafe.npcs?.[i];
        if (evalRaw) stripRollingRelationshipFields(evalRaw, { explicitZero: false });
        if (safeRaw) stripRollingRelationshipFields(safeRaw, { explicitZero: true });
    }
    return { evaluation, mergeSafe };
}
