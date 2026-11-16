/* Records the appearance-field receipt of one scan update, with its outcome and grounding, in a scan report. */
import * as mechanics from '../core-mechanics.js';
import * as continuity from '../continuity-core.js';
import { PROFILE_DEVELOPMENT_OBSERVATION_LIMIT, parseProfileDevelopmentEvidence, profileDevelopmentText } from '../core-profile-development-ledger.js';
export function recordAppearanceDiagnostic(report, beforeNpc, afterNpc, rawUpdate, options = {}, allNpcs = []) {
    if (!report || !beforeNpc || !afterNpc) return;
    const raw = rawUpdate && typeof rawUpdate === 'object' ? rawUpdate : {};
    const normalized = continuity.normalizeScanNpc(raw);
    const evidenceSource = raw?.evidence ?? raw?.profileEvidence ?? raw?.profile_evidence ?? {};
    const rawEvidence = Array.isArray(evidenceSource?.appearance) ? evidenceSource.appearance : [];
    const providerFieldPresent = [
        'appearance', 'appearanceState', 'appearance_state', 'appearanceReason', 'appearance_reason',
        'overallAppearance', 'overall_appearance', 'appearanceForms', 'appearance_forms',
        'currentForm', 'current_form', 'currentFormState', 'current_form_state',
    ].some(key => Object.prototype.hasOwnProperty.call(raw, key));
    const providerEvidencePresent = rawEvidence.length > 0;
    const structuredAppearancePresent = [
        'overallAppearance', 'overall_appearance', 'appearanceForms', 'appearance_forms',
        'currentForm', 'current_form', 'currentFormState', 'current_form_state',
    ].some(key => Object.prototype.hasOwnProperty.call(raw, key));
    const previousValue = profileDevelopmentText('appearance', beforeNpc.appearance, 720);
    const candidateValue = profileDevelopmentText('appearance', normalized.appearance, 720);
    const currentValue = profileDevelopmentText('appearance', afterNpc.appearance, 720);
    const locked = Array.isArray(beforeNpc?.manualProfileFields) && beforeNpc.manualProfileFields.includes('appearance');
    const flatCandidateChanged = Boolean(candidateValue)
        && mechanics.normalizeName(candidateValue) !== mechanics.normalizeName(previousValue);
    const changed = mechanics.normalizeName(currentValue) !== mechanics.normalizeName(previousValue);
    const diagnosticCandidate = candidateValue || (structuredAppearancePresent && changed ? currentValue : '');
    const candidateChanged = Boolean(diagnosticCandidate)
        && mechanics.normalizeName(diagnosticCandidate) !== mechanics.normalizeName(previousValue);
    const candidateAlreadyRepresented = Boolean(diagnosticCandidate) && !candidateChanged;
    const otherLabels = (Array.isArray(allNpcs) ? allNpcs : [])
        .filter(other => String(other?.id || '') !== String(afterNpc?.id || ''))
        .flatMap(other => [other?.name, ...(Array.isArray(other?.aliases) ? other.aliases : [])])
        .filter(Boolean).slice(0, 64);
    const binding = {
        npc: afterNpc,
        evidence: rawEvidence,
        targeted: options.allowTargetedDurableSeed === true || options.developmentSingleTarget === true,
        otherLabels,
    };
    const candidateGrounded = flatCandidateChanged && normalized.appearanceState !== 'change'
        ? mechanics.durableRefinementCandidateGrounded(
            'appearance',
            previousValue,
            candidateValue,
            options.developmentContext || '',
            rawEvidence,
            binding,
        )
        : null;
    const fieldReason = profileDevelopmentText('appearance', normalized.appearanceReason, 500);
    const outcome = !providerFieldPresent && !providerEvidencePresent ? 'not-provided'
        : (locked ? 'locked'
            : (changed ? (structuredAppearancePresent && !candidateValue ? 'applied-form-update' : `applied-${normalized.appearanceState || 'update'}`)
                : (!candidateValue
                    ? (structuredAppearancePresent ? 'form-update-unchanged-or-gated' : 'candidate-missing')
                    : (candidateAlreadyRepresented ? 'unchanged' : 'unchanged-or-gated'))));
    const evidence = rawEvidence.slice(0, PROFILE_DEVELOPMENT_OBSERVATION_LIMIT).map(item => {
        const parsed = parseProfileDevelopmentEvidence('appearance', item);
        return {
            sourceMessageId: parsed?.sourceMessageId ?? null,
            concept: parsed?.explicitConcept || parsed?.concept || '',
            sample: parsed?.body || profileDevelopmentText('appearance', item, mechanics.DURABLE_PROFILE_LIMITS.evidence),
        };
    });
    report.profileDevelopment = Array.isArray(report.profileDevelopment) ? report.profileDevelopment : [];
    report.profileDevelopment.push({
        npcId: String(afterNpc.id || ''),
        field: 'appearance',
        outcome,
        modelState: normalized.appearanceState || 'keep',
        scale: '',
        effectiveScale: '',
        locked,
        previous: previousValue,
        candidate: diagnosticCandidate,
        fieldReason,
        providerReasonPresent: Boolean(fieldReason),
        effectiveReason: fieldReason,
        effectiveReasonSource: fieldReason ? 'field' : 'none',
        candidateChanged,
        candidateAlreadyRepresented,
        evidenceAlreadyRepresented: null,
        evidenceResolved: false,
        candidateGrounded,
        reasonGrounded: null,
        providerFieldPresent,
        structuredAppearancePresent,
        providerEvidencePresent,
        evidence,
    });
    if (report.profileDevelopment.length > 48) report.profileDevelopment.splice(0, report.profileDevelopment.length - 48);
}
