// Builds suite profiles for the tracked, non-archived, not-deceased NPCs.
import { buildNpcProfile } from './profile-build.js';
// Dead in the dossier: lifeState 'deceased' (explicit or inferred), or archived as deceased. A
// confirmed death is archived automatically only while Auto-archive deaths is on, and an inferred
// one never is, so the archive flag alone does not keep the dead out of a companion picker.
function isDeceased(npc) {
    return String(npc?.lifeState ?? '').trim().toLowerCase() === 'deceased' || npc?.archiveReason === 'deceased';
}

/** Suite profiles for the tracked, non-archived, not-deceased NPCs, in dossier order; never throws. */
export function buildNpcProfiles(npcs, options = {}) {
    try {
        return Object.freeze((Array.isArray(npcs) ? npcs : [])
            .filter(npc => npc && typeof npc === 'object' && !npc.archived && !isDeceased(npc))
            .map(npc => buildNpcProfile(npc, options)));
    } catch (error) {
        console.warn('[NPC State Delta] Story Suite NPC profiles failed', error);
        return Object.freeze([]);
    }
}
