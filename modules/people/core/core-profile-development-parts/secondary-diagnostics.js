/* Records the mannerisms and behaviorProfile receipts of one scan update, with outcomes and grounding, in a scan report. */
import * as mechanics from '../core-mechanics.js';
import * as continuity from '../continuity-core.js';
import { PROFILE_DEVELOPMENT_OBSERVATION_LIMIT, parseProfileDevelopmentEvidence, profileDevelopmentText } from '../core-profile-development-ledger.js';
export function recordSecondaryProfileDiagnostics(report, beforeNpc, afterNpc, rawUpdate, options = {}, allNpcs = []) {
    if (!report || !afterNpc || !rawUpdate) return;
    const normalized = continuity.normalizeScanNpc(rawUpdate);
    const evidenceSource = rawUpdate?.evidence ?? rawUpdate?.profileEvidence ?? rawUpdate?.profile_evidence ?? {};
    const otherLabels = (Array.isArray(allNpcs) ? allNpcs : [])
        .filter(other => String(other?.id || '') !== String(afterNpc?.id || ''))
        .flatMap(other => [other?.name, ...(Array.isArray(other?.aliases) ? other.aliases : [])])
        .filter(Boolean).slice(0, 64);
    for (const field of ['mannerisms', 'behaviorProfile']) {
        const stateField = field === 'mannerisms' ? 'mannerismState' : 'behaviorProfileState';
        const reasonField = field === 'mannerisms' ? 'mannerismReason' : 'behaviorProfileReason';
        const provided = field === 'mannerisms' ? normalized.mannerismsProvided : normalized.behaviorProfileProvided;
        if (!provided) {
            // Explain why stored non-lever entries survived: the provider omitted the field or
            // proposed only non-lever entries, which intake drops.
            if (field !== 'behaviorProfile') continue;
            const rawBehavior = rawUpdate.behaviorProfile ?? rawUpdate.behavior_profile;
            const nonLeverOnly = Array.isArray(normalized.nonLeverBehavior) && normalized.nonLeverBehavior.length > 0;
            const stored = Array.isArray(beforeNpc?.behaviorProfile) ? beforeNpc.behaviorProfile : [];
            if (!nonLeverOnly && !stored.some(entry => !mechanics.isBehaviorLever(entry))) continue;
            report.profileDevelopment = Array.isArray(report.profileDevelopment) ? report.profileDevelopment : [];
            report.profileDevelopment.push({
                npcId: String(afterNpc.id || ''),
                field,
                outcome: nonLeverOnly ? 'non-lever-only' : 'not-provided',
                modelState: normalized[stateField] || 'keep',
                locked: Array.isArray(beforeNpc?.manualProfileFields) && beforeNpc.manualProfileFields.includes(field),
                providerFieldPresent: rawBehavior !== undefined,
                previous: profileDevelopmentText(field, stored.join(' | '), 720),
                candidate: profileDevelopmentText(field, (normalized.nonLeverBehavior || []).join(' | '), 720),
                evidence: [],
            });
            if (report.profileDevelopment.length > 48) report.profileDevelopment.splice(0, report.profileDevelopment.length - 48);
            continue;
        }
        const previousValue = Array.isArray(beforeNpc?.[field]) ? beforeNpc[field].join(' | ') : '';
        const candidateValue = Array.isArray(normalized?.[field]) ? normalized[field].join(' | ') : '';
        const currentValue = Array.isArray(afterNpc?.[field]) ? afterNpc[field].join(' | ') : '';
        const locked = Array.isArray(beforeNpc?.manualProfileFields) && beforeNpc.manualProfileFields.includes(field);
        const rawEvidence = Array.isArray(evidenceSource?.[field]) ? evidenceSource[field] : [];
        const binding = {
            npc: afterNpc,
            evidence: rawEvidence,
            targeted: options.allowTargetedDurableSeed === true || options.developmentSingleTarget === true,
            otherLabels,
        };
        const developmentReason = profileDevelopmentText(field, normalized.developmentReason, 500);
        const fieldReason = profileDevelopmentText(field, normalized[reasonField], 500);
        const evidenceReason = mechanics.durableProfileEvidenceReason(field, beforeNpc?.[field] || [], normalized?.[field] || [], rawEvidence);
        const effectiveReason = developmentReason || fieldReason || evidenceReason;
        const effectiveReasonSource = developmentReason ? 'provider' : (fieldReason ? 'field' : (evidenceReason ? 'evidence' : 'none'));
        const candidateChanged = !mechanics.durableProfileCollectionEquivalent(field, beforeNpc?.[field] || [], normalized?.[field] || []);
        const candidateSpecificGrounding = candidateChanged
            && mechanics.durableProfileCollectionCandidateGrounded(field, beforeNpc?.[field] || [], normalized?.[field] || [], rawEvidence);
        const episode = mechanics.developmentEpisodeDiagnostic(effectiveReason, options.developmentContext, binding);
        const inferredBatch = normalized.developmentScale === 'gradual'
            && candidateChanged
            && candidateSpecificGrounding
            && Boolean(effectiveReason)
            && Boolean(String(options.developmentContext || '').trim())
            && mechanics.developmentScaleReady('batch', effectiveReason, options.developmentContext, binding);
        const changed = !mechanics.durableProfileCollectionEquivalent(field, beforeNpc?.[field] || [], afterNpc?.[field] || []);
        const candidateAlreadyRepresented = Boolean(candidateValue)
            && mechanics.durableProfileCollectionEquivalent(field, beforeNpc?.[field] || [], normalized?.[field] || []);
        const evidenceAlreadyRepresented = mechanics.durableProfileEvidenceAlreadyRepresented(
            field,
            afterNpc?.[field] || [],
            rawEvidence,
        );
        const recoveredKeepRefinement = field === 'behaviorProfile'
            && changed
            && (normalized[stateField] || 'keep') === 'keep';
        const outcome = locked ? 'locked'
            : (changed && inferredBatch ? 'applied-inferred-batch'
                : (recoveredKeepRefinement ? 'applied-recovered-refine'
                    : (changed ? `applied-${normalized[stateField] || 'update'}`
                    : (candidateAlreadyRepresented
                        ? (evidenceAlreadyRepresented ? 'evidence-already-reflected' : 'waiting-for-revised-candidate')
                        : 'unchanged-or-gated'))));
        const evidence = rawEvidence.slice(0, PROFILE_DEVELOPMENT_OBSERVATION_LIMIT).map(item => {
            const parsed = parseProfileDevelopmentEvidence(field, item);
            return {
                sourceMessageId: parsed?.sourceMessageId ?? null,
                concept: parsed?.explicitConcept || parsed?.concept || '',
                sample: parsed?.body || profileDevelopmentText(field, item, mechanics.DURABLE_PROFILE_LIMITS.evidence),
            };
        });
        report.profileDevelopment = Array.isArray(report.profileDevelopment) ? report.profileDevelopment : [];
        report.profileDevelopment.push({
            npcId: String(afterNpc.id || ''),
            field,
            outcome,
            modelState: normalized[stateField] || 'keep',
            scale: normalized.developmentScale || 'gradual',
            effectiveScale: inferredBatch ? 'batch' : (normalized.developmentScale || 'gradual'),
            inferredScale: inferredBatch,
            locked,
            previous: profileDevelopmentText(field, previousValue, 720),
            candidate: profileDevelopmentText(field, candidateValue, 720),
            developmentReason,
            fieldReason,
            providerReasonPresent: Boolean(developmentReason),
            effectiveReason,
            effectiveReasonSource,
            candidateChanged,
            candidateAlreadyRepresented,
            evidenceAlreadyRepresented,
            evidenceResolved: rawEvidence.length ? evidenceAlreadyRepresented : false,
            candidateGrounded: candidateChanged ? candidateSpecificGrounding : null,
            reasonGrounded: effectiveReason ? episode.grounded : null,
            episode,
            evidence,
        });
        if (report.profileDevelopment.length > 48) report.profileDevelopment.splice(0, report.profileDevelopment.length - 48);
    }
}
