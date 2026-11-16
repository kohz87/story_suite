// Allowlisted sanitizers for one profile-development row and one birthday row of a diagnostic operation.
import { clean, finiteInt } from './shared-clean.js';

function sanitizeEpisode(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        detected: Boolean(raw.detected),
        grounded: Boolean(raw.grounded),
        npcBound: raw.npcBound === null || raw.npcBound === undefined ? null : Boolean(raw.npcBound),
        anchorIndex: finiteInt(raw.anchorIndex),
        segmentCount: Math.max(0, finiteInt(raw.segmentCount, 0)),
    };
}
function sanitizeCalendarDate(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const year = raw.year === null || raw.year === undefined || raw.year === '' ? null : finiteInt(raw.year);
    return {
        era: clean(raw.era, 24),
        year,
        month: clean(raw.month, 40),
        day: finiteInt(raw.day),
    };
}
function sanitizeEvidence(raw = []) {
    return (Array.isArray(raw) ? raw : []).slice(0, 8).map(item => ({
        sourceMessageId: finiteInt(item?.sourceMessageId),
        concept: clean(item?.concept, 80),
        sample: clean(item?.sample, 320),
    })).filter(item => item.sourceMessageId !== null || item.concept || item.sample);
}
export function sanitizeProfileDiagnostic(raw = {}) {
    return {
        npcId: clean(raw.npcId, 160),
        field: clean(raw.field, 48),
        outcome: clean(raw.outcome, 80),
        modelState: clean(raw.modelState, 32),
        providerScale: clean(raw.scale ?? raw.providerScale, 32),
        effectiveScale: clean(raw.effectiveScale, 32),
        inferredScale: Boolean(raw.inferredScale),
        inferredEffectiveScale: clean(raw.inferredEffectiveScale, 32),
        ready: Boolean(raw.ready),
        aggregateReady: Boolean(raw.aggregateReady),
        aggregateFallback: Boolean(raw.aggregateFallback),
        observations: Math.max(0, finiteInt(raw.observations, 0)),
        aggregateObservations: Math.max(0, finiteInt(raw.aggregateObservations, 0)),
        locked: Boolean(raw.locked),
        candidateChanged: raw.candidateChanged === undefined ? null : Boolean(raw.candidateChanged),
        candidateAlreadyRepresented: Boolean(raw.candidateAlreadyRepresented),
        evidenceAlreadyRepresented: raw.evidenceAlreadyRepresented === undefined ? null : Boolean(raw.evidenceAlreadyRepresented),
        evidenceResolved: Boolean(raw.evidenceResolved),
        candidateGrounded: raw.candidateGrounded === undefined ? null : Boolean(raw.candidateGrounded),
        reasonGrounded: raw.reasonGrounded === undefined ? null : Boolean(raw.reasonGrounded),
        providerReasonPresent: Boolean(raw.providerReasonPresent),
        providerFieldPresent: raw.providerFieldPresent === undefined ? null : Boolean(raw.providerFieldPresent),
        providerEvidencePresent: raw.providerEvidencePresent === undefined ? null : Boolean(raw.providerEvidencePresent),
        effectiveReasonSource: clean(raw.effectiveReasonSource, 24),
        effectiveReason: clean(raw.effectiveReason, 500),
        previous: clean(raw.previous, 720),
        candidate: clean(raw.candidate, 720),
        developmentReason: clean(raw.developmentReason, 500),
        fieldReason: clean(raw.fieldReason, 500),
        episode: sanitizeEpisode(raw.episode),
        evidence: sanitizeEvidence(raw.evidence),
    };
}
export function sanitizeBirthdayDiagnostic(raw = {}) {
    return {
        npcId: clean(raw.npcId, 160),
        outcome: clean(raw.outcome, 40),
        reason: clean(raw.reason, 120),
        birthdayMatched: Boolean(raw.birthdayMatched),
        establishedNow: Boolean(raw.establishedNow),
        birthdaySupplied: Boolean(raw.birthdaySupplied),
        birthDateState: clean(raw.birthDateState, 24),
        narratedBirthday: Boolean(raw.narratedBirthday),
        ageState: clean(raw.ageState, 24),
        ageLocked: Boolean(raw.ageLocked),
        apparentAgeLocked: Boolean(raw.apparentAgeLocked),
        previousAge: clean(raw.previousAge, 12),
        age: clean(raw.age, 12),
        previousApparentAge: clean(raw.previousApparentAge, 16),
        apparentAge: clean(raw.apparentAge, 16),
        delta: finiteInt(raw.delta, 0),
        previousBirthDate: sanitizeCalendarDate(raw.previousBirthDate),
        birthDate: sanitizeCalendarDate(raw.birthDate),
        birthDateYearSource: clean(raw.birthDateYearSource, 32),
        calendarAge: finiteInt(raw.calendarAge),
        referenceDate: sanitizeCalendarDate(raw.referenceDate),
    };
}
