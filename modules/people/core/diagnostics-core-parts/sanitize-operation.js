// Allowlisted sanitizer for one whole diagnostic operation (its profile and birthday rows, ids and accounting).
import { clean, finiteInt, uniqueStrings } from './shared-clean.js';
import { sanitizeProfileDiagnostic, sanitizeBirthdayDiagnostic } from './sanitize-rows.js';

export function sanitizeDiagnosticOperation(raw = {}) {
    const profile = (Array.isArray(raw.profile) ? raw.profile : Array.isArray(raw.profileDevelopment) ? raw.profileDevelopment : [])
        .map(sanitizeProfileDiagnostic).filter(row => row.npcId && row.field).slice(-64);
    const birthdays = (Array.isArray(raw.birthdays) ? raw.birthdays : Array.isArray(raw.birthdayDiagnostics) ? raw.birthdayDiagnostics : [])
        .map(sanitizeBirthdayDiagnostic).filter(row => row.npcId).slice(-32);
    const npcIds = uniqueStrings([
        ...(Array.isArray(raw.npcIds) ? raw.npcIds : []),
        ...profile.map(row => row.npcId),
        ...birthdays.map(row => row.npcId),
    ], 64, 160);
    return {
        id: clean(raw.id, 120),
        type: clean(raw.type ?? raw.label, 80) || 'scan',
        at: Math.max(0, finiteInt(raw.at, Date.now())),
        durationMs: Math.max(0, finiteInt(raw.durationMs, 0)),
        sourceMessageId: finiteInt(raw.sourceMessageId),
        retried: Boolean(raw.retried),
        targeted: Boolean(raw.targeted),
        npcIds,
        accounting: {
            profileUpdates: Math.max(0, finiteInt(raw.profileUpdates, 0)),
            profileApplied: Math.max(0, finiteInt(raw.profileApplied, 0)),
            profileEvidenceAdded: Math.max(0, finiteInt(raw.profileEvidenceAdded, 0)),
            relationshipApplied: Math.max(0, finiteInt(raw.relationshipApplied, 0)),
            promptEstimateTokens: Math.max(0, finiteInt(raw.promptEstimateTokens, 0)),
            responseEstimateTokens: Math.max(0, finiteInt(raw.responseEstimateTokens, 0)),
        },
        profile,
        birthdays,
    };
}
