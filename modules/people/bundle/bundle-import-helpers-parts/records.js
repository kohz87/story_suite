// Imported dossier record handling: the import report, manual-lock preservation and source reply numbers.
import { LOCKED_FIELD_KEYS } from '../src/dossier-edit.js';

export function initImportReport(report) {
    if (!report || typeof report !== 'object') return null;
    report.updated = [];
    report.added = [];
    report.skipped = [];
    report.idRemaps = [];
    report.accepted = [];
    return report;
}

export function preserveTargetManualLocks(oldNpc, importedNpc) {
    const targetLocks = new Set(Array.isArray(oldNpc?.manualProfileFields) ? oldNpc.manualProfileFields : []);
    const sourceLocks = new Set(Array.isArray(importedNpc?.manualProfileFields) ? importedNpc.manualProfileFields : []);
    const merged = { ...oldNpc, ...importedNpc };
    for (const field of targetLocks) {
        for (const key of LOCKED_FIELD_KEYS[field] || []) {
            if (Object.prototype.hasOwnProperty.call(oldNpc || {}, key)) merged[key] = structuredClone(oldNpc[key]);
            else delete merged[key];
        }
    }
    merged.manualProfileFields = [...new Set([...targetLocks, ...sourceLocks])];
    merged.manualProfileLocksExplicit = Boolean(
        oldNpc?.manualProfileLocksExplicit || importedNpc?.manualProfileLocksExplicit || merged.manualProfileFields.length,
    );
    return merged;
}

// Reply numbers (1.2.3, display only) are message indexes in the source chat. A foreign dossier keeps
// its relationship events, which then show as older records do, but never another chat's numbering.
export function withoutSourceReplyNumbers(npc) {
    if (npc.lastRelationshipChange && typeof npc.lastRelationshipChange === 'object') delete npc.lastRelationshipChange.message;
    for (const event of Array.isArray(npc.relationshipEventHistory) ? npc.relationshipEventHistory : []) {
        if (event && typeof event === 'object') delete event.message;
    }
    delete npc.fieldChangeMessages;
    delete npc.memoryStamps;
    delete npc.memoryFacts;   // another chat's event keys, ledger and source replies never suppress or date this chat's events
}
