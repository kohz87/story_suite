/* Records one profile-development receipt (ready, observations, evidence) in a scan report. */
import * as mechanics from '../core-mechanics.js';
import { PROFILE_DEVELOPMENT_OBSERVATION_LIMIT, profileDevelopmentSourceMessageId, profileDevelopmentText } from '../core-profile-development-ledger.js';
export function recordProfileDevelopmentDiagnostic(report, npcId, field, outcome, plan = null, details = {}) {
    if (!report || !npcId || !field || !outcome) return;
    report.profileDevelopment = Array.isArray(report.profileDevelopment) ? report.profileDevelopment : [];
    const observations = Math.max(0, ...(plan?.ledger?.concepts || []).map(record => Number(record?.observationCount || 0)));
    const evidence = (Array.isArray(plan?.evidence) ? plan.evidence : []).slice(0, PROFILE_DEVELOPMENT_OBSERVATION_LIMIT).map(item => ({
        sourceMessageId: profileDevelopmentSourceMessageId(item?.sourceMessageId),
        concept: profileDevelopmentText(field, item?.explicitConcept || item?.concept, 60),
        sample: profileDevelopmentText(field, item?.body, mechanics.DURABLE_PROFILE_LIMITS.evidence),
    }));
    report.profileDevelopment.push({
        npcId: String(npcId),
        field,
        outcome,
        ready: Boolean(plan?.readyRecords?.length),
        aggregateReady: Boolean(plan?.aggregateEvidence?.ready),
        aggregateObservations: Number(plan?.aggregateEvidence?.count || 0),
        locked: Boolean(plan?.locked),
        observations,
        previous: profileDevelopmentText(field, plan?.beforeValue),
        candidate: profileDevelopmentText(field, plan?.update?.[field]),
        evidence,
        ...details,
    });
    if (report.profileDevelopment.length > 48) report.profileDevelopment.splice(0, report.profileDevelopment.length - 48);
}
