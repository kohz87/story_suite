/* Dossier admission rules: whether a scanned person gets a dossier at once or a pending candidate is promoted. */
import { normalizeNpcAdmissionMode } from '../core-record-shared.js';

export function shouldCreateDossierImmediately(incoming, admissionMode = 'conservative') {
    const mode = normalizeNpcAdmissionMode(admissionMode);
    if (mode === 'manual_only') return false;
    if (incoming.identityKind === 'proper_name') return true;
    if (mode === 'balanced' && (incoming.dossierSignal === 'meaningful' || incoming.dossierSignal === 'persistent' || incoming.directInteraction)) return true;
    // Conservative intentionally ignores model-assigned relevance for a first-seen role label.
    // Role NPCs must earn promotion through confirmed recurrence or an explicit manual add.
    return false;
}

export function shouldPromoteCandidate(candidate, incoming, admissionMode = 'conservative') {
    const mode = normalizeNpcAdmissionMode(admissionMode);
    if (shouldCreateDossierImmediately(incoming, mode)) return true;
    if (mode === 'manual_only') return false;
    return Boolean(incoming.sameIndividual) && Number(candidate?.seenCount || 0) >= 2;
}
