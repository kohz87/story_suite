// Keeping the reader's own NPC metadata (portrait, locks, user fields) when a restore brings back older NPC records.
import { lockedFieldKeys } from '../../dossier/dossier-edit.js';
import { portraitHasImage } from '../../portrait/portrait-file.js';
import { BRANCH_USER_METADATA_FIELDS } from '../../fields/registry.js';
import { cloneNpcList, npcLabels } from './shared-npc-records.js';

function findNpcForMetadataRestore(npc, currentNpcs = []) {
    const records = Array.isArray(currentNpcs) ? currentNpcs : [];
    if (npc?.id) {
        const exact = records.find(candidate => candidate?.id && candidate.id === npc.id);
        if (exact) return exact;
    }
    const labels = new Set(npcLabels(npc));
    if (!labels.size) return null;
    const matches = records.filter(candidate => npcLabels(candidate).some(label => labels.has(label)));
    return matches.length === 1 ? matches[0] : null;
}

export function preserveUserNpcMetadata(restoredNpcs = [], currentNpcs = []) {
    const restored = cloneNpcList(restoredNpcs);
    const globallyPreserved = BRANCH_USER_METADATA_FIELDS;
    for (const npc of restored) {
        // Retired dossier metadata must not be resurrected by historical checkpoints.
        delete npc.importance;
        delete npc.manual;
        const current = findNpcForMetadataRestore(npc, currentNpcs);
        if (!current) continue;
        if (portraitHasImage(current?.portrait)) npc.portrait = structuredClone(current.portrait);
        // A cast dossier's portrait the reader removed on purpose stays removed through a restore (the pack's picture is not filled in again).
        if (current?.castFrom?.portraitRemoved === true && npc.castFrom && typeof npc.castFrom === 'object' && npc.castFrom.key === current.castFrom.key) {
            npc.castFrom = { ...npc.castFrom, portraitRemoved: true };
        }
        for (const field of globallyPreserved) {
            if (Object.prototype.hasOwnProperty.call(current, field)) npc[field] = structuredClone(current[field]);
        }
        if (current.manualProfileLocksExplicit) {
            const locked = Array.isArray(current.manualProfileFields) ? [...current.manualProfileFields] : [];
            // A lock keeps every key its field is made of (an appearance lock keeps the forms too).
            for (const key of new Set(locked.flatMap(lockedFieldKeys))) {
                if (Object.prototype.hasOwnProperty.call(current, key)) npc[key] = structuredClone(current[key]);
                else delete npc[key];
            }
            npc.manualProfileFields = locked;
            npc.manualProfileLocksExplicit = true;
            if (locked.includes('name')) npc.aliases = structuredClone(current.aliases || npc.aliases || []);
        }
    }
    return restored;
}
