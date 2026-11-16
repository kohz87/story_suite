/* Normalizers for the relationship impact level, with the scanner recovery rule. */
import { RELATIONSHIP_IMPACT_LEVELS } from './impact-caps-constants.js';

export function normalizeRelationshipImpact(value, hasDelta = false) {
    const impact = String(value ?? '').trim().toLowerCase();
    if (RELATIONSHIP_IMPACT_LEVELS.includes(impact)) return impact;
    return hasDelta ? 'ordinary' : 'none';
}

export function normalizeScannerRelationshipImpact(value, hasDelta = false) {
    const impact = normalizeRelationshipImpact(value, hasDelta);
    // Scanner payloads that pair a concrete non-zero delta with `none` are contradictory.
    // Keep the low-level engine's `none` semantics intact, but recover scanner mistakes
    // to the smallest non-zero tier instead of silently swallowing the delta.
    return hasDelta && impact === 'none' ? 'ordinary' : impact;
}
