/* Clears a field's stored profile evidence and marks an NPC's profile as applied in a scan report. */
export function clearProfileEvidence(npc, field) {
    const profileEvidence = npc?.profileEvidence && typeof npc.profileEvidence === 'object' && !Array.isArray(npc.profileEvidence)
        ? npc.profileEvidence
        : {};
    npc.profileEvidence = { ...profileEvidence, [field]: [] };
}

export function markProfileApplied(report, npcId) {
    if (!report || !npcId) return;
    report.updated = Array.isArray(report.updated) ? report.updated : [];
    report.profileUpdated = Array.isArray(report.profileUpdated) ? report.profileUpdated : [];
    if (!report.updated.includes(npcId)) report.updated.push(npcId);
    const alreadyApplied = report.profileUpdated.includes(npcId);
    if (!alreadyApplied) report.profileUpdated.push(npcId);
    report.profileUpdateStats = report.profileUpdateStats && typeof report.profileUpdateStats === 'object'
        ? report.profileUpdateStats
        : { provided: 0, applied: 0, evidenceAdded: 0 };
    if (!alreadyApplied) report.profileUpdateStats.applied = Number(report.profileUpdateStats.applied || 0) + 1;
}
