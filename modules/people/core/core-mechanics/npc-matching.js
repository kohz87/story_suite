// Matches scan rows and records to an NPC by id, name or alias.
import { npcMatchesLabel } from '../core-record.js';

// A scan row or profile update is about this NPC: the same id, its name, or one of its aliases.
export function scanRowMatchesNpc(raw = {}, npc = {}) {
    if (raw?.id && String(raw.id) === String(npc?.id)) return true;
    if (raw?.name && npcMatchesLabel(npc, raw.name)) return true;
    return Array.isArray(raw?.aliases) && raw.aliases.some(alias => npcMatchesLabel(npc, alias));
}

// The records in `source` that are this NPC (by id, or a name or alias matching either way).
export function matchingNpcRecords(npc, source = []) {
    return (Array.isArray(source) ? source : []).filter(item => item && (
        String(item.id || '') === String(npc?.id || '')
        || (npc?.name && npcMatchesLabel(item, npc.name))
        || (item?.name && npcMatchesLabel(npc, item.name))
        || (item?.aliases || []).some(alias => npcMatchesLabel(npc, alias))
    ));
}
